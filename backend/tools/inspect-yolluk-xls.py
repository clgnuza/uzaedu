import xlrd
import sys

path = r"C:\Users\mehme\Downloads\yolluk2026.xls"
book = xlrd.open_workbook(path, formatting_info=False)
print("sheets:", book.sheet_names())
for si, name in enumerate(book.sheet_names()):
    if any(x in name.lower() for x in ("sürekli", "surekli", "yer değiştirme", "yer degistirme")):
        print("---", name, "idx", si)
        sh = book.sheet_by_index(si)
        print("nrows", sh.nrows, "ncols", sh.ncols)
        for r in range(min(45, sh.nrows)):
            row = []
            for c in range(min(20, sh.ncols)):
                v = sh.cell_value(r, c)
                if isinstance(v, float) and v == int(v):
                    v = int(v)
                row.append(str(v)[:40])
            if any(x.strip() for x in row):
                print(r, "|", " | ".join(row))
