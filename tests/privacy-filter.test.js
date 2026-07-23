const test = require('node:test');
const assert = require('node:assert/strict');
const { maskPersonalInfo } = require('../privacy-filter');

test('주민등록번호와 전화번호를 마스킹한다', () => {
  const result = maskPersonalInfo('연락처는 010-1234-5678이고 주민번호는 900101-1234567입니다.');
  assert.equal(result.hasPersonalInfo, true);
  assert.doesNotMatch(result.maskedText, /010-1234-5678|900101-1234567/);
  assert.match(result.maskedText, /\[연락처 제외\]/);
  assert.match(result.maskedText, /\[주민등록번호 제외\]/);
});

test('표지어가 붙은 성명을 마스킹하고 일반 물건명은 유지한다', () => {
  const result = maskPersonalInfo('소유자 김철수이고 철제 컨테이너 창고 한 동입니다.');
  assert.match(result.maskedText, /소유자 \[성명 제외\]/);
  assert.match(result.maskedText, /철제 컨테이너 창고/);
});

test('규격과 수량만 있는 물건 설명은 변경하지 않는다', () => {
  const text = '비닐하우스 두 동, 파이프 구조, 5미터 곱하기 20미터';
  const result = maskPersonalInfo(text);
  assert.equal(result.hasPersonalInfo, false);
  assert.equal(result.maskedText, text);
});
