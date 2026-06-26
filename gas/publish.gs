/**
 * 수업꾸러미 — 시트 "발행" 버튼용 Google Apps Script.
 *
 * 동작: kits/items/stage_meta 3개 탭을 그대로 JSON으로 직렬화해
 *       GitHub(data/raw/*.json)에 커밋한다. push → Cloudflare Pages 빌드가
 *       변환·검증·새니타이즈(scripts/sheet-to-json.ts) 후 배포한다.
 *       (변환 로직은 GAS가 아니라 Pages 빌드에 있다 — GAS는 단순 커밋만.)
 *
 * 설치:
 *   1) 확장 프로그램 > Apps Script 에 이 파일 붙여넣기.
 *   2) 프로젝트 설정 > 스크립트 속성에 GITHUB_TOKEN 추가
 *      (fine-grained PAT, 대상 레포 Contents: Read and write).
 *   3) 시트에 그림/버튼 삽입 → 스크립트 할당: '발행'.
 *   4) 첫 실행 시 권한 동의 1회.
 */

var CONFIG = {
  owner: 'eduinside',
  repo: 'edu-kit',
  branch: 'main',          // 검수 모드면 'content'로 바꾸고 PR 운영
  dir: 'data/raw',
  tabs: ['kits', 'items', 'stage_meta'],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('수업꾸러미')
    .addItem('GitHub에 발행', '발행')
    .addToUi();
}

/** 버튼/메뉴에 연결되는 진입점. 결과를 'log' 시트에 한 줄로 기록한다. */
function 발행() {
  var user = '';
  try { user = Session.getActiveUser().getEmail() || ''; } catch (e) {}

  try {
    var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    if (!token) throw new Error('스크립트 속성 GITHUB_TOKEN 이 필요합니다.');

    // 빈 id 칸에 shortId 자동 부여 후 시트에 되써서 영구 고정(URL 안정)
    var newIds = ensureKitIds_();

    var changed = [];
    CONFIG.tabs.forEach(function (tab) {
      var json = JSON.stringify(tabToRows(tab), null, 2) + '\n';
      if (commitFile(token, CONFIG.dir + '/' + tab + '.json', json, '발행: ' + tab)) {
        changed.push(tab);
      }
    });

    var detail =
      (newIds.length ? 'id부여[' + newIds.join(',') + '] ' : '') +
      (changed.length ? '커밋[' + changed.join(',') + ']' : '변경없음');
    logRow_(user, changed.length ? '성공' : '변경없음', detail);

    var msg = changed.length
      ? '발행 커밋 완료: ' + changed.join(', ') + '\n(수 분 후 사이트에 반영)'
      : '변경 사항이 없습니다.';
    if (newIds.length) msg = 'shortId 자동 부여: ' + newIds.join(', ') + '\n' + msg;
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  } catch (err) {
    var emsg = String((err && err.message) || err);
    logRow_(user, '실패', emsg);
    try { SpreadsheetApp.getUi().alert('발행 실패\n' + emsg); } catch (e) { Logger.log(emsg); }
    throw err;
  }
}

/** 'log' 시트에 발행 기록 한 줄 추가(없으면 생성). */
function logRow_(user, status, detail) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('log');
  if (!sheet) {
    sheet = ss.insertSheet('log');
    sheet.appendRow(['시각', '실행자', '상태', '내용']);
    sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#1f7af0').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 4, 160);
    sheet.setColumnWidth(4, 420);
  }
  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var ts = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([ts, user, status, detail]);
}

/** kits 탭의 빈 id 칸에 base31 4자 shortId를 부여하고 시트에 되쓴다. 부여한 id 목록 반환. */
function ensureKitIds_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('kits');
  if (!sheet) throw new Error('kits 탭을 찾을 수 없습니다.');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('id');
  if (idCol < 0) throw new Error('kits 탭에 id 컬럼이 필요합니다.');

  var existing = {};
  for (var r = 1; r < values.length; r++) {
    var v = String(values[r][idCol] || '').trim();
    if (v) existing[v] = true;
  }

  var assigned = [];
  for (var r = 1; r < values.length; r++) {
    var rowHasContent = values[r].some(function (c) { return c !== '' && c !== null; });
    if (!rowHasContent) continue;                 // 빈 행 건너뜀
    var cur = String(values[r][idCol] || '').trim();
    if (cur) continue;                            // 이미 id 있음
    var id = genShortId_(existing);
    existing[id] = true;
    sheet.getRange(r + 1, idCol + 1).setValue(id); // 시트에 되쓰기(영구 고정)
    assigned.push(id);
  }
  if (assigned.length) SpreadsheetApp.flush();
  return assigned;
}

/** 혼동 문자 제외 base31, 충돌 회피 */
function genShortId_(existing) {
  var a = '23456789abcdefghijkmnpqrstuvwxyz';
  for (var len = 4; len <= 6; len++) {
    for (var t = 0; t < 100; t++) {
      var s = '';
      for (var i = 0; i < len; i++) s += a.charAt(Math.floor(Math.random() * a.length));
      if (!existing[s]) return s;
    }
  }
  throw new Error('shortId 생성 실패');
}

/** 한 탭을 [{헤더:값,...}, ...] 배열로 변환. 빈 행/빈 셀 제거. */
function tabToRows(tabName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
  if (!sheet) throw new Error('탭을 찾을 수 없습니다: ' + tabName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    var hasAny = false;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = values[r][c];
      if (v === '' || v === null || v === undefined) continue;
      obj[headers[c]] = v;
      hasAny = true;
    }
    if (hasAny) rows.push(obj);
  }
  return rows;
}

/** GitHub Contents API 로 파일 생성/갱신. 내용이 같으면 skip(false) 반환. */
function commitFile(token, path, content, message) {
  var base = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + path;
  var headers = {
    Authorization: 'token ' + token,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'edu-kit-gas',
  };

  // 기존 파일 sha + 내용 조회
  var sha = null, existing = null;
  var getRes = UrlFetchApp.fetch(base + '?ref=' + CONFIG.branch, {
    method: 'get', headers: headers, muteHttpExceptions: true,
  });
  if (getRes.getResponseCode() === 200) {
    var meta = JSON.parse(getRes.getContentText());
    sha = meta.sha;
    existing = Utilities.newBlob(Utilities.base64Decode(meta.content)).getDataAsString();
  }
  if (existing === content) return false; // 변경 없음

  var payload = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: CONFIG.branch,
  };
  if (sha) payload.sha = sha;

  var putRes = UrlFetchApp.fetch(base, {
    method: 'put', headers: headers, contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  var code = putRes.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('GitHub 커밋 실패(' + code + '): ' + putRes.getContentText());
  }
  return true;
}
