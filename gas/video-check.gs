/**
 * 수업꾸러미 — 시트 "영상 점검" 버튼용 Google Apps Script.
 *
 * 동작: items 탭의 video_url 을 모아 YouTube Data API(videos.list)로
 *       임베드 가능 여부를 일괄 점검한다. 결과는 시트에만 남기고
 *       GitHub/사이트는 건드리지 않는다(발행과 완전히 분리).
 *
 *   - items 탭  : 문제 있는 video_url 셀에 배경색 + 메모(값은 그대로 → 발행 JSON 영향 0)
 *   - video_check 탭 : 최근 1회 점검의 문제 목록(매번 덮어씀)
 *   - video_log 탭   : 실행 이력 누적(한 줄씩 쌓임)
 *
 * 설치:
 *   1) publish.gs 와 같은 Apps Script 프로젝트에 이 파일을 추가한다.
 *   2) 프로젝트 설정 > 스크립트 속성에 YT_API_KEY 추가
 *      (Google Cloud 콘솔 > YouTube Data API v3 사용자 인증 정보의 API 키).
 *   3) 시트에 버튼(그림) 삽입 → 스크립트 할당: '영상점검'.
 *      (publish.gs 의 onOpen 이 '수업꾸러미 > 영상 점검' 메뉴도 만든다.)
 *
 * 쿼터: id 50개를 한 번에 묶어 보내므로 호출당 1 unit.
 *       영상 1,000개 ≈ 20 units. 무료 일일 10,000 units 대비 무시할 수준.
 */

var VC = {
  itemsTab: 'items',
  reportTab: 'video_check',
  logTab: 'video_log',
  urlCol: 'video_url',
  batchSize: 50,      // videos.list 의 id 최대 개수
  region: 'KR',       // 지역 차단 판정 기준
  badBg: '#fce8e6',   // 문제 셀 배경(연한 빨강)
  warnBg: '#fff3cd',  // 점검 실패 셀 배경(연한 노랑)
};

/** 버튼/메뉴에 연결되는 진입점. */
function 영상점검() {
  var started = new Date();
  var user = '';
  try { user = Session.getActiveUser().getEmail() || ''; } catch (e) {}

  try {
    var key = PropertiesService.getScriptProperties().getProperty('YT_API_KEY');
    if (!key) throw new Error('스크립트 속성 YT_API_KEY 가 필요합니다.');

    var targets = collectVideoTargets_();          // [{row, kitId, itemKey, title, url, videoId}]
    if (!targets.length) throw new Error(VC.itemsTab + ' 탭에서 점검할 video_url 을 찾지 못했습니다.');

    var info = fetchVideoInfo_(key, targets);      // { videoId: {...} }, 실패 배치는 null 표시
    var results = targets.map(function (t) { return judge_(t, info); });

    var problems = results.filter(function (r) { return r.verdict !== '정상'; });
    var summary = summarize_(results);

    paintItemsColumn_(results);
    writeReport_(results, started);
    var elapsed = Math.round((new Date() - started) / 1000);
    vcLogRow_(started, user, results.length, results.length - problems.length, problems.length, summary, elapsed);

    var msg = '영상 점검 완료 (' + elapsed + '초)\n' +
      '검사 ' + results.length + '개 / 정상 ' + (results.length - problems.length) + '개 / 문제 ' + problems.length + '개\n' +
      (problems.length ? summary + '\n\n문제 목록: ' + VC.reportTab + ' 탭' : '모두 정상입니다.');
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  } catch (err) {
    var emsg = String((err && err.message) || err);
    vcLogRow_(started, user, 0, 0, 0, '실패: ' + emsg, Math.round((new Date() - started) / 1000));
    try { SpreadsheetApp.getUi().alert('영상 점검 실패\n' + emsg); } catch (e) { Logger.log(emsg); }
    throw err;
  }
}

/** items 탭에서 video_url 이 있는 행을 모은다. */
function collectVideoTargets_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VC.itemsTab);
  if (!sheet) throw new Error('탭을 찾을 수 없습니다: ' + VC.itemsTab);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function (h) { return String(h).trim(); });
  var cUrl = headers.indexOf(VC.urlCol);
  if (cUrl < 0) throw new Error(VC.itemsTab + ' 탭에 ' + VC.urlCol + ' 컬럼이 필요합니다.');
  var cKit = headers.indexOf('kit_id');
  var cKey = headers.indexOf('item_key');
  var cTitle = headers.indexOf('title');

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var url = String(values[r][cUrl] || '').trim();
    if (!url) continue;
    out.push({
      row: r + 1,                                   // 1-based 시트 행번호
      kitId: cKit >= 0 ? String(values[r][cKit] || '') : '',
      itemKey: cKey >= 0 ? String(values[r][cKey] || '') : '',
      title: cTitle >= 0 ? String(values[r][cTitle] || '') : '',
      url: url,
      videoId: extractVideoId_(url),
      urlCol: cUrl + 1,
      lastRow: values.length,
    });
  }
  return out;
}

/** 전체 YouTube URL 또는 11자 id → 11자 video_id. (scripts/field-map.ts 와 동일 규칙) */
function extractVideoId_(urlOrId) {
  if (!urlOrId) return '';
  var s = String(urlOrId).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  var m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

/**
 * id 를 50개씩 묶어 videos.list 호출. 반환: { videoId: item }.
 * 응답에 없는 id 는 키가 없다(= 삭제/비공개). 배치 자체가 실패하면 해당 id 들을 null 로 표시.
 */
function fetchVideoInfo_(key, targets) {
  var ids = [];
  var seen = {};
  targets.forEach(function (t) {
    if (t.videoId && !seen[t.videoId]) { seen[t.videoId] = true; ids.push(t.videoId); }
  });

  var requests = [];
  var batches = [];
  for (var i = 0; i < ids.length; i += VC.batchSize) {
    var chunk = ids.slice(i, i + VC.batchSize);
    batches.push(chunk);
    requests.push({
      url: 'https://www.googleapis.com/youtube/v3/videos'
        + '?part=status,contentDetails'
        + '&id=' + chunk.join(',')
        + '&key=' + encodeURIComponent(key),
      method: 'get',
      muteHttpExceptions: true,
    });
  }

  var info = {};
  var responses = requests.length ? UrlFetchApp.fetchAll(requests) : [];
  for (var b = 0; b < responses.length; b++) {
    var res = responses[b];
    if (res.getResponseCode() !== 200) {
      // 배치 실패(키 오류·쿼터 초과 등) → 해당 id 들을 '점검실패'로 남긴다.
      batches[b].forEach(function (id) { info[id] = null; });
      continue;
    }
    var body = JSON.parse(res.getContentText() || '{}');
    (body.items || []).forEach(function (it) { info[it.id] = it; });
  }
  return info;
}

/** 한 행의 판정. verdict: 정상 / URL오류 / 삭제·비공개 / 비공개 / 임베드차단 / 연령제한 / 국내차단 / 점검실패 */
function judge_(t, info) {
  var base = { row: t.row, kitId: t.kitId, itemKey: t.itemKey, title: t.title, url: t.url, urlCol: t.urlCol, lastRow: t.lastRow };

  if (!t.videoId) return ext_(base, 'URL오류', '유튜브 영상 ID를 뽑아낼 수 없는 주소입니다.');
  if (!(t.videoId in info)) return ext_(base, '삭제·비공개', 'API 응답에 없음 — 삭제되었거나 비공개로 바뀐 영상입니다.');
  var v = info[t.videoId];
  if (v === null) return ext_(base, '점검실패', 'API 호출 실패(키·쿼터 확인) — 다시 실행해 주세요.');

  var st = v.status || {};
  var cd = v.contentDetails || {};

  if (st.privacyStatus === 'private') return ext_(base, '비공개', '비공개 영상입니다.');
  if (st.uploadStatus === 'rejected' || st.uploadStatus === 'deleted') {
    return ext_(base, '삭제·비공개', 'uploadStatus=' + st.uploadStatus);
  }
  if (st.embeddable === false) return ext_(base, '임베드차단', '업로더가 외부 사이트 삽입을 막았습니다. 대체 영상으로 교체하거나, 불가하면 items 탭 video_embed 칸에 FALSE 입력(뷰어가 유튜브 링크 카드로 대체).');
  if (cd.contentRating && cd.contentRating.ytRating === 'ytAgeRestricted') {
    return ext_(base, '연령제한', '연령 제한 영상 — 삽입 재생이 되지 않습니다(로그인 요구). 학생용으로 부적합.');
  }

  var rr = cd.regionRestriction;
  if (rr) {
    if (rr.blocked && rr.blocked.indexOf(VC.region) >= 0) {
      return ext_(base, '국내차단', VC.region + ' 지역에서 시청이 차단된 영상입니다.');
    }
    if (rr.allowed && rr.allowed.indexOf(VC.region) < 0) {
      return ext_(base, '국내차단', VC.region + ' 이 허용 지역 목록에 없습니다.');
    }
  }

  var note = st.privacyStatus === 'unlisted' ? '일부공개(임베드는 정상)' : '';
  return ext_(base, '정상', note);
}

function ext_(base, verdict, detail) {
  base.verdict = verdict;
  base.detail = detail || '';
  return base;
}

/** 판정별 개수 요약 문자열. */
function summarize_(results) {
  var counts = {};
  results.forEach(function (r) {
    if (r.verdict === '정상') return;
    counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  });
  var parts = [];
  for (var k in counts) parts.push(k + ' ' + counts[k]);
  return parts.length ? parts.join(', ') : '문제 없음';
}

/**
 * items 탭 video_url 열에 배경색·메모만 입힌다. 셀 "값"은 건드리지 않으므로
 * 발행 JSON(data/raw/items.json)에는 아무 영향이 없다.
 */
function paintItemsColumn_(results) {
  if (!results.length) return;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VC.itemsTab);
  var col = results[0].urlCol;
  var lastRow = results[0].lastRow;
  if (lastRow < 2) return;

  var n = lastRow - 1;                              // 2행 ~ lastRow
  var bg = [], notes = [];
  for (var i = 0; i < n; i++) { bg.push([null]); notes.push(['']); }  // 이전 점검 표시 초기화

  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  results.forEach(function (r) {
    if (r.verdict === '정상') return;
    var i = r.row - 2;
    if (i < 0 || i >= n) return;
    bg[i] = [r.verdict === '점검실패' ? VC.warnBg : VC.badBg];
    notes[i] = ['[' + stamp + ' 영상 점검] ' + r.verdict + '\n' + r.detail];
  });

  var range = sheet.getRange(2, col, n, 1);
  range.setBackgrounds(bg);
  range.setNotes(notes);
}

/** video_check 탭에 이번 점검의 문제 목록을 쓴다(매번 덮어씀). */
function writeReport_(results, started) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(VC.reportTab);
  if (!sheet) sheet = ss.insertSheet(VC.reportTab);
  sheet.clear();

  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var ts = Utilities.formatDate(started, tz, 'yyyy-MM-dd HH:mm:ss');
  var problems = results.filter(function (r) { return r.verdict !== '정상'; });

  var header = ['items행', 'kit_id', 'item_key', 'title', 'video_url', '판정', '상세'];
  var rows = problems.map(function (r) {
    return [r.row, r.kitId, r.itemKey, r.title, r.url, r.verdict, r.detail];
  });

  sheet.getRange(1, 1, 1, 2).setValues([['최근 점검', ts + '  ·  검사 ' + results.length + '개  ·  문제 ' + problems.length + '개']]);
  sheet.getRange(1, 1).setFontWeight('bold');
  sheet.getRange(3, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setBackground('#1f7af0').setFontColor('#ffffff');
  if (rows.length) sheet.getRange(4, 1, rows.length, header.length).setValues(rows);
  else sheet.getRange(4, 1).setValue('- 문제 없음 -');

  sheet.setFrozenRows(3);
  var widths = [70, 90, 130, 260, 340, 90, 420];
  widths.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
}

/** video_log 탭에 실행 이력 한 줄 추가(없으면 생성). */
function vcLogRow_(started, user, total, ok, ng, summary, elapsed) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(VC.logTab);
  if (!sheet) {
    sheet = ss.insertSheet(VC.logTab);
    sheet.appendRow(['시각', '실행자', '검사', '정상', '문제', '내용', '소요(초)']);
    sheet.getRange('A1:G1').setFontWeight('bold').setBackground('#1f7af0').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    var widths = [160, 220, 70, 70, 70, 420, 80];
    widths.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
  }
  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var ts = Utilities.formatDate(started, tz, 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([ts, user, total, ok, ng, summary, elapsed]);
}
