import os
import datetime as dt
from dataclasses import dataclass
from typing import Dict, List
import tkinter as tk
from tkinter import ttk, messagebox

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


SECTIONS = {
    "heat": "ОТОПЛЕНИЕ",
    "vent": "ВЕНТИЛЯЦИЯ",
    "ac": "КОНДИЦИОНИРОВАНИЕ",
    "video": "ВИДЕОНАБЛЮДЕНИЕ",
    "fire": "ПОЖАРНАЯ СИГНАЛИЗАЦИЯ",
}

DEFAULT_ITEMS = {
    "heat": ["Котёл отопительный настенный газовый;1;шт;0", "Радиаторы панельные;1;компл;0"],
    "vent": ["Приточно-вытяжная установка;1;шт;0", "Воздуховоды и решётки;1;компл;0"],
    "ac": ["VRF наружный блок;1;шт;0", "Внутренние блоки;1;шт;0"],
    "video": ["IP-камеры;1;шт;0", "NVR регистратор;1;шт;0"],
    "fire": ["ППК;1;шт;0", "Дымовые извещатели;1;шт;0"],
}


def _num(v: str) -> float:
    try:
        return float(str(v).replace(' ', '').replace(',', '.'))
    except Exception:
        return 0.0


def _fmt(v: float) -> str:
    return f"{v:,.2f}".replace(',', ' ').replace('.', ',')


def _safe_filename(s: str) -> str:
    out = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '_' for ch in s.strip())
    return out[:50] or 'KP'


def _register_font() -> str:
    candidates = [
        r"C:\\Windows\\Fonts\\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont("KPFont", path))
            return "KPFont"
    return "Helvetica"


@dataclass
class Item:
    name: str
    qty: float
    unit: str
    price: float

    @property
    def total(self) -> float:
        return self.qty * self.price


def build_data(fields: Dict[str, str], section_enabled: Dict[str, bool], section_lines: Dict[str, str]):
    parsed: Dict[str, List[Item]] = {}
    for sec, raw in section_lines.items():
        items = []
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = [x.strip() for x in line.split(';')]
            while len(parts) < 4:
                parts.append('')
            items.append(Item(parts[0], _num(parts[1]), parts[2] or 'шт', _num(parts[3])))
        parsed[sec] = items

    include_vat = fields.get('include_vat', '1') == '1'
    vat_rate = 0.22
    totals = {k: sum(i.total for i in v) for k, v in parsed.items() if section_enabled.get(k)}
    subtotal = sum(totals.values())
    vat = subtotal * vat_rate if include_vat else 0
    total = subtotal + vat

    return {
        'fields': fields,
        'enabled': section_enabled,
        'items': parsed,
        'totals': totals,
        'subtotal': subtotal,
        'vat': vat,
        'total': total,
        'include_vat': include_vat,
    }


def generate_pdf(data, output_path: str):
    font = _register_font()
    page_w, page_h = A4
    m = 20
    c = canvas.Canvas(output_path, pagesize=A4)

    def new_page(y_start=page_h - m):
        c.showPage()
        c.setFont(font, 9)
        return y_start

    def draw_header(y):
        c.setFont(font, 15)
        c.drawString(m, y, "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ")
        y -= 18
        c.setFont(font, 10)
        c.drawString(m, y, f"Компания: {data['fields'].get('comp_name','')}")
        y -= 12
        c.drawString(m, y, f"КП № {data['fields'].get('kp_num','')}    Получатель: {data['fields'].get('kp_client','')}")
        y -= 12
        c.drawString(m, y, f"Дата: {dt.date.today().strftime('%d.%m.%Y')}")
        return y - 10

    def ensure_space(y, needed):
        if y - needed < m:
            y = new_page()
            y = draw_header(y)
        return y

    c.setFont(font, 9)
    y = page_h - m
    y = draw_header(y)

    # table header
    def draw_table_header(y):
        c.setFillColor(colors.HexColor('#173763'))
        c.rect(m, y - 16, page_w - 2 * m, 16, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(font, 8)
        c.drawString(m + 4, y - 11, '№')
        c.drawString(m + 22, y - 11, 'Наименование')
        c.drawRightString(page_w - m - 190, y - 11, 'Кол-во')
        c.drawRightString(page_w - m - 130, y - 11, 'Ед.')
        c.drawRightString(page_w - m - 70, y - 11, 'Цена')
        c.drawRightString(page_w - m - 5, y - 11, 'Сумма')
        return y - 20

    y = draw_table_header(y)

    section_colors = {
        'heat': '#ef8b2c', 'vent': '#31a065', 'ac': '#2f7fd7', 'video': '#8a4ed6', 'fire': '#d14e4e'
    }

    for sec, title in SECTIONS.items():
        if not data['enabled'].get(sec):
            continue
        items = data['items'].get(sec) or []
        if not items:
            continue

        # keep section block clean: header + at least 2 rows + total
        min_block = 18 + 2 * 16 + 18
        y = ensure_space(y, min_block)

        c.setFillColor(colors.HexColor(section_colors.get(sec, '#555')))
        c.rect(m, y - 16, page_w - 2 * m, 16, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(font, 8)
        c.drawString(m + 6, y - 11, title)
        y -= 18

        c.setFillColor(colors.black)
        c.setFont(font, 8)

        for idx, item in enumerate(items, 1):
            row_h = 16
            y = ensure_space(y, row_h + 18)
            if idx % 2 == 0:
                c.setFillColor(colors.HexColor('#f8fbff'))
                c.rect(m, y - row_h + 2, page_w - 2 * m, row_h, fill=1, stroke=0)
                c.setFillColor(colors.black)
            c.drawString(m + 4, y - 10, str(idx))
            c.drawString(m + 22, y - 10, item.name[:64])
            c.drawRightString(page_w - m - 190, y - 10, _fmt(item.qty))
            c.drawRightString(page_w - m - 130, y - 10, item.unit)
            c.drawRightString(page_w - m - 70, y - 10, _fmt(item.price))
            c.drawRightString(page_w - m - 5, y - 10, _fmt(item.total))
            y -= row_h

        y = ensure_space(y, 18)
        c.setFillColor(colors.HexColor('#eef3f8'))
        c.rect(m, y - 14, page_w - 2 * m, 14, fill=1, stroke=0)
        c.setFillColor(colors.HexColor('#173763'))
        c.drawRightString(page_w - m - 5, y - 10, f"Итого по разделу: {_fmt(data['totals'][sec])}")
        y -= 18

    y = ensure_space(y, 55)
    c.setFillColor(colors.HexColor('#20252d'))
    c.rect(m, y - 16, page_w - 2 * m, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.drawRightString(page_w - m - 5, y - 11, f"ИТОГО БЕЗ НДС: {_fmt(data['subtotal'])}")
    y -= 20

    if data['include_vat']:
        c.setFillColor(colors.HexColor('#e8eef7'))
        c.rect(m, y - 16, page_w - 2 * m, 16, fill=1, stroke=0)
        c.setFillColor(colors.HexColor('#173763'))
        c.drawRightString(page_w - m - 5, y - 11, f"НДС 22%: {_fmt(data['vat'])}")
        y -= 20

    c.setFillColor(colors.HexColor('#8f8f8f'))
    c.rect(m, y - 18, page_w - 2 * m, 18, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(font, 9)
    c.drawRightString(page_w - m - 5, y - 12, f"ОБЩАЯ СУММА: {_fmt(data['total'])}")

    c.save()


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("KP Generator Desktop")
        self.geometry("1180x760")

        self.fields = {}
        self.section_enabled = {}
        self.section_text = {}

        self._build_ui()

    def _build_ui(self):
        root = ttk.Frame(self, padding=10)
        root.pack(fill='both', expand=True)

        left = ttk.Frame(root)
        left.pack(side='left', fill='both', expand=True)

        right = ttk.Frame(root)
        right.pack(side='right', fill='both', padx=(10, 0))

        for label, key, default in [
            ('Компания', 'comp_name', 'ИП Рамазанов Ф.Д.'),
            ('№ КП', 'kp_num', '001 / 2026'),
            ('Получатель', 'kp_client', ''),
        ]:
            ttk.Label(left, text=label).pack(anchor='w')
            e = ttk.Entry(left)
            e.insert(0, default)
            e.pack(fill='x', pady=(0, 6))
            self.fields[key] = e

        self.include_vat = tk.BooleanVar(value=True)
        ttk.Checkbutton(left, text='Добавить НДС 22%', variable=self.include_vat).pack(anchor='w', pady=(0, 6))

        notebook = ttk.Notebook(left)
        notebook.pack(fill='both', expand=True)

        for sec, title in SECTIONS.items():
            frm = ttk.Frame(notebook)
            notebook.add(frm, text=title)
            en = tk.BooleanVar(value=True if sec in ('heat', 'vent', 'ac') else False)
            ttk.Checkbutton(frm, text='Включить раздел', variable=en).pack(anchor='w', padx=6, pady=4)
            self.section_enabled[sec] = en

            ttk.Label(frm, text='Формат строки: Наименование;Кол-во;Ед;Цена').pack(anchor='w', padx=6)
            txt = tk.Text(frm, height=14, wrap='word')
            txt.pack(fill='both', expand=True, padx=6, pady=6)
            txt.insert('1.0', '\n'.join(DEFAULT_ITEMS[sec]))
            self.section_text[sec] = txt

        ttk.Button(right, text='Экспорт PDF (сразу)', command=self.export_pdf_now).pack(fill='x', pady=(0, 6))
        self.status = ttk.Label(right, text='Готово')
        self.status.pack(anchor='w')

    def export_pdf_now(self):
        fields = {k: w.get() for k, w in self.fields.items()}
        fields['include_vat'] = '1' if self.include_vat.get() else '0'

        enabled = {k: v.get() for k, v in self.section_enabled.items()}
        lines = {k: t.get('1.0', 'end').strip() for k, t in self.section_text.items()}

        data = build_data(fields, enabled, lines)

        out_name = f"KP_{_safe_filename(fields.get('kp_num',''))}_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        out_path = os.path.join(os.getcwd(), out_name)
        try:
            generate_pdf(data, out_path)
            self.status.configure(text=f'PDF готов: {out_name}')
            messagebox.showinfo('Успех', f'PDF сохранён:\n{out_path}')
            if os.name == 'nt':
                os.startfile(out_path)
        except Exception as e:
            messagebox.showerror('Ошибка', str(e))


if __name__ == '__main__':
    app = App()
    app.mainloop()
