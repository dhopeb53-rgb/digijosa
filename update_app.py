import codecs

content = codecs.open('app.js', 'r', 'utf-8').read()

start_idx = content.find("    // Insert new row for '사업자등록증상 소재지'")
end_idx = content.find("    // Shifted down by 8 rows total (below Row 18)")

if start_idx == -1 or end_idx == -1:
    print("Could not find start or end index")
    exit(1)

new_code = """    // Insert new rows (16 to 23, total 8 rows)
    for (let i = 0; i < 8; i++) {
      wsSurvey.insertRow(16 + i, [], 'i');
    }

    // Copy style from Row 14 and 15
    const templateRow14 = wsSurvey.getRow(14);
    const templateRow15 = wsSurvey.getRow(15);
    
    for (let i = 0; i < 8; i += 2) {
      const newRow1 = wsSurvey.getRow(16 + i);
      const newRow2 = wsSurvey.getRow(17 + i);
      newRow1.height = templateRow14.height;
      newRow2.height = templateRow15.height;
      for (let col = 1; col <= 30; col++) {
        newRow1.getCell(col).style = templateRow14.getCell(col).style;
        newRow2.getCell(col).style = templateRow15.getCell(col).style;
      }
    }

    const headerStyle = wsSurvey.getCell('C14').style;
    const valueStyle = wsSurvey.getCell('F14').style;

    // Apply specific styles for new rows to match the horizontal layout
    for (let r = 16; r <= 19; r++) {
      for (let c = 3; c <= 5; c++) {
        wsSurvey.getCell(r, c).fill = headerStyle.fill;
        wsSurvey.getCell(r, c).font = headerStyle.font;
        wsSurvey.getCell(r, c).alignment = { vertical: 'middle', horizontal: 'center' };
      }
      for (let c = 6; c <= 30; c++) {
        wsSurvey.getCell(r, c).fill = valueStyle.fill;
        wsSurvey.getCell(r, c).font = valueStyle.font;
        wsSurvey.getCell(r, c).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }
    }

    for (let r = 20; r <= 21; r++) {
      for (let c = 3; c <= 30; c++) {
        wsSurvey.getCell(r, c).fill = headerStyle.fill;
        wsSurvey.getCell(r, c).font = headerStyle.font;
        wsSurvey.getCell(r, c).alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }
    for (let r = 22; r <= 23; r++) {
      for (let c = 3; c <= 30; c++) {
        wsSurvey.getCell(r, c).fill = valueStyle.fill;
        wsSurvey.getCell(r, c).font = valueStyle.font;
        wsSurvey.getCell(r, c).alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }
    
    // Re-merge ranges with shifted coords
    const mergeList = [
      'A6:B23', // expanded sidebar (Rows 6 to 23 is 18 rows)
      'C14:E15', 'F14:P15', 'Q14:T15', 'U14:AD15', // 사업자등록번호 / 법인등록번호 (Original)
      
      // New rows based on '기본조사서 참고용' layout
      'C16:E17', 'F16:AD17', // 사업자등록증상 소재지
      'C18:E19', 'F18:AD19', // 물건소재지
      
      // Booleans Headers
      'C20:E21', 'F20:I21', 'J20:N21', 'O20:S21', 'T20:W21', 'X20:AD21',
      
      // Booleans Values
      'C22:E23', 'F22:I23', 'J22:N23', 'O22:S23', 'T22:W23', 'X22:AD23',
      
      'A24:B28', 'C24:AD28', // 평면도 (shifted by 8 rows total)
      'A29:B32', 'C29:AD32', // 특기사항
      'A34:N37', 'O34:AD35', 'O36:AD37' // 조사일자, 조사자, 입회자
    ];
    mergeList.forEach(rng => {
      try { wsSurvey.mergeCells(rng); } catch (e) {}
    });
    
    // Write new fields
    wsSurvey.getCell('C16').value = '사업자등록증상 소재지';
    wsSurvey.getCell('F16').value = db.survey.bizLocation || '';
    
    wsSurvey.getCell('C18').value = '물건소재지';
    wsSurvey.getCell('F18').value = db.survey.itemLocation || '';
    
    wsSurvey.getCell('C20').value = '지구외 여부';
    wsSurvey.getCell('F20').value = '자가/임차';
    wsSurvey.getCell('J20').value = '건축물대장 유무';
    wsSurvey.getCell('O20').value = '영업장 여부';
    wsSurvey.getCell('T20').value = '거주 여부';
    wsSurvey.getCell('X20').value = '기타허가사항';
    
    wsSurvey.getCell('C22').value = db.survey.outOfDistrict ? 'Y' : 'N';
    wsSurvey.getCell('F22').value = db.survey.rentType || '';
    wsSurvey.getCell('J22').value = db.survey.hasLedger ? 'Y' : 'N';
    wsSurvey.getCell('O22').value = db.survey.isBusiness ? 'Y' : 'N';
    wsSurvey.getCell('T22').value = db.survey.isResidence ? 'Y' : 'N';
    wsSurvey.getCell('X22').value = db.survey.permitNotes || '';
    wsSurvey.getCell('X22').alignment = Object.assign({}, wsSurvey.getCell('X22').alignment, { wrapText: true, horizontal: 'left' });

    // Write original survey values
    wsSurvey.getCell('F6').value = db.survey.company || '';
    wsSurvey.getCell('S6').value = db.survey.bizType || '';
    
    const locationVal = formatExcelAddress(db.survey.location, db.survey.locationRoad, db.survey.locationZip, db.survey.locationDetail);
    const cellF8 = wsSurvey.getCell('F8');
    cellF8.value = locationVal;
    cellF8.alignment = Object.assign({}, cellF8.alignment, { wrapText: true, vertical: 'middle' });
    
    wsSurvey.getCell('H10').value = db.survey.repName || '';
    wsSurvey.getCell('U10').value = db.survey.repJumin || '';
    
    const repVal = formatExcelAddress(db.survey.repAddr, db.survey.repRoad, db.survey.repZip, db.survey.repDetail);
    const cellH12 = wsSurvey.getCell('H12');
    cellH12.value = repVal;
    cellH12.alignment = Object.assign({}, cellH12.alignment, { wrapText: true, vertical: 'middle' });
    
    wsSurvey.getCell('U12').value = db.survey.repContact || '';
    
    // (Original row 14)
    wsSurvey.getCell('F14').value = db.survey.bizRegNo || '';
    wsSurvey.getCell('U14').value = db.survey.corpRegNo || '';

"""

content = content[:start_idx] + new_code + content[end_idx:]
codecs.open('app.js', 'w', 'utf-8').write(content)
print('Updated app.js')
