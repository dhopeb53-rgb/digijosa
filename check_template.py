import re, base64, openpyxl, io
tjs = open('d:/josa/template_data.js', 'r', encoding='utf-8').read()
m = re.search(r'TEMPLATE_BASE64\s*=\s*"([^"]+)"', tjs)
b64 = m.group(1)
wb = openpyxl.load_workbook(io.BytesIO(base64.b64decode(b64)))
ws = wb['조사서']
print('Merged cells:', ws.merged_cells.ranges)
for r in range(1, 40):
    for c in range(1, 35):
        val = ws.cell(r,c).value
        if val is not None:
            print(f'R{r}C{c}: {val}')
