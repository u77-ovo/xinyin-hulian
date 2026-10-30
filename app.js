const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  mode: 'elder',
  sample: 'fraud',
  scenario: 0,
  score: 40,
  analyzing: false,
  mediaRecorder: null,
  mediaStream: null,
  recognition: null,
  recordingTimer: null,
  recordingStartedAt: 0,
  recordedSeconds: 0,
  voiceContent: '',
};

const copy = {
  elder: {
    hero: '一句话、一通电话，就能启动核验。我们用大字、语音和清晰步骤，把复杂风险讲明白。',
    action: '开始语音核验',
    cardTitle: '帮我听听这通电话',
    cardDesc: '按一下，复述对方说的话',
    kicker: '长辈模式 · 来电核验',
    title: '把可疑的话，交给我们一起听',
    step: '说出对方刚才的话',
    fraudLabel: '冒充公检法',
    safeLabel: '社区正常通知',
  },
  student: {
    hero: '截图、语音、视频一次核验。看见 AI 伪造痕迹，也看懂骗局如何一步步让人上钩。',
    action: '上传内容核验',
    cardTitle: '拆解这条可疑消息',
    cardDesc: '支持截图与 AI 音视频核验',
    kicker: '校园模式 · 多模态核验',
    title: '把截图或音视频，放进风险透镜',
    step: '上传可疑内容',
    fraudLabel: 'AI 换脸借钱',
    safeLabel: '导师正常通知',
  },
};

const scenarioCopy = {
  elder: [
    {
      avatar: '警', type: '来自“公安局”的来电', name: '王警官',
      quote: '“你的银行卡涉嫌洗钱，现在必须配合调查。不要告诉任何人……”',
      question: '对方让你添加“办案专员”并开启屏幕共享。',
      choices: [
        ['按要求添加并共享屏幕', '先配合，证明自己没问题'],
        ['继续通话，问清警号', '让对方先证明身份'],
        ['挂断，用官方号码回拨核验', '切断对方营造的封闭情境'],
      ]
    },
    {
      avatar: '药', type: '“健康管理中心”来电', name: '李主任',
      quote: '“您的体检指标很危险，今天购买特效疗程可以享受国家补贴……”',
      question: '对方说名额只剩 3 个，要求现在支付 4,980 元。',
      choices: [
        ['马上付款，先占住补贴名额', '机会难得，不能错过'],
        ['让对方再多介绍一下疗效', '听完再做决定'],
        ['拒绝付款，咨询正规医院', '不被稀缺话术催促'],
      ]
    }
  ],
  student: [
    {
      avatar: '友', type: '视频来电 · “大学室友”', name: '陈航',
      quote: '“我手机银行限额了，急着交住院押金，你先转 8,000，晚上就还你。”',
      question: '画面中的室友声音和长相都正常，但一直催你立刻转账。',
      choices: [
        ['直接转账，室友不会骗我', '视频里确实是熟悉的人'],
        ['让他在视频里再解释一遍', '继续观察画面是否异常'],
        ['挂断，用另一渠道联系本人', '通过预设暗号或电话核实'],
      ]
    },
    {
      avatar: '单', type: '兼职群 · 高薪任务', name: '金牌派单员',
      quote: '“前两单本金和佣金都返了，再做一单 2,999 元联单就能提现。”',
      question: '账户显示已有 680 元收益，但提现前必须完成最后一单。',
      choices: [
        ['继续垫付，拿回前面的本金', '已经投入，不想半途而废'],
        ['问群友是否真的能提现', '看看其他人的成功截图'],
        ['停止付款，保留证据并报警', '识别沉没成本与群体托儿'],
      ]
    }
  ]
};

function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${name}Screen`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMode(mode) {
  if (state.mediaStream) stopRecording(false);
  state.mode = mode;
  document.body.classList.toggle('student-mode', mode === 'student');
  document.body.classList.toggle('elder-mode', mode === 'elder');
  $$('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  const c = copy[mode];
  $('#heroDescription').textContent = c.hero;
  $('#mainActionLabel').textContent = c.action;
  $('#checkCardTitle').textContent = c.cardTitle;
  $('#checkCardDesc').textContent = c.cardDesc;
  $('#checkKicker').textContent = c.kicker;
  $('#checkTitle').textContent = c.title;
  $('#inputStepTitle').textContent = c.step;
  $('#fraudSampleLabel').textContent = c.fraudLabel;
  $('#safeSampleLabel').textContent = c.safeLabel;
  $('#voiceStage').hidden = mode === 'student';
  $('#uploadStage').hidden = mode !== 'student';
  resetAnalysis();
  state.scenario = 0;
  state.score = 40;
  renderScenario();
}

function resetAnalysis() {
  state.analyzing = false;
  $('#emptyAnalysis').hidden = false;
  $('#scanningAnalysis').hidden = true;
  $('#resultAnalysis').hidden = true;
  $('#analysisState').textContent = '等待内容';
  $('#analyzeButton span').textContent = '开始智能核验';
}

function sampleContent() {
  const spokenText = $('#voiceTranscript')?.value.trim();
  if (state.mode === 'elder' && spokenText) return `用户复述：“${spokenText}”`;
  const safe = state.sample === 'safe';
  if (state.mode === 'elder') {
    return safe
      ? '“王阿姨您好，明天上午社区组织免费体检，请带身份证到居委会登记。如有疑问请拨打公告栏上的电话。”'
      : '“我是公安局王警官，你涉嫌洗钱。不要告诉家人，马上把钱转到安全账户……”';
  }
  return safe
    ? '导师群通知：“明天下午组会改到 3 点，地点仍为实验楼 302。论文请上传学校云盘，不用提供账号密码。”'
    : '视频中的“室友”：“我在医院，手机银行限额了。你先转 8,000 元，别打电话，我现在不方便说。”';
}

function runAnalysis() {
  if (state.analyzing) return;
  const spokenText = $('#voiceTranscript')?.value.trim();
  if (state.mode === 'elder' && spokenText) {
    const dangerPattern = /转账|汇款|安全账户|验证码|屏幕共享|涉嫌|洗钱|保密|不要告诉|立即付款|名额|银行卡|密码/;
    state.sample = dangerPattern.test(spokenText) ? 'fraud' : 'safe';
    $$('.sample').forEach(s => s.classList.toggle('active', s.dataset.sample === state.sample));
  }
  state.analyzing = true;
  $('#emptyAnalysis').hidden = true;
  $('#resultAnalysis').hidden = true;
  $('#scanningAnalysis').hidden = false;
  $('#transcriptText').textContent = sampleContent();
  $('#analysisState').textContent = '多源交叉核验中';
  $('#analyzeButton span').textContent = '正在核验…';
  const steps = $$('.scan-step');
  steps[0].querySelector('b').textContent = '完成';
  steps[1].querySelector('b').textContent = '分析中';
  steps[2].querySelector('b').textContent = '等待';
  setTimeout(() => {
    steps[1].querySelector('b').textContent = '完成';
    steps[2].querySelector('b').textContent = '分析中';
  }, 700);
  setTimeout(showResult, 1600);
}

function showResult() {
  const safe = state.sample === 'safe';
  $('#scanningAnalysis').hidden = true;
  $('#resultAnalysis').hidden = false;
  $('#analysisState').textContent = safe ? '需要更多背景' : '核验完成';
  $('#analyzeButton span').textContent = '重新核验';
  state.analyzing = false;

  if (!safe) {
    const score = state.mode === 'elder' ? 92 : 89;
    $('#riskNumber').textContent = score;
    $('#riskTag').textContent = '高度可疑';
    $('#resultTitle').textContent = state.mode === 'elder' ? '这很像冒充公检法诈骗' : '检测到 AI 冒充借款风险';
    $('#resultSubtitle').textContent = state.mode === 'elder' ? '先挂断，不转账，不提供验证码。' : '不要只相信画面，请用另一渠道联系本人。';
    $('#riskTag').style.cssText = '';
    $('.score-progress').style.stroke = 'var(--danger)';
    $('.score-progress').style.strokeDashoffset = '26';
    $('#evidenceGrid').innerHTML = state.mode === 'elder'
      ? '<div><span>01</span><b>要求保密</b><p>骗子常用“不能告诉家人”隔离受害者</p></div><div><span>02</span><b>安全账户</b><p>公检法机关不会通过电话要求转账</p></div><div><span>03</span><b>制造紧迫</b><p>用“立即处理”压缩你的思考时间</p></div>'
      : '<div><span>01</span><b>异常回避</b><p>拒绝电话回拨，只允许单一视频渠道</p></div><div><span>02</span><b>唇音微偏差</b><p>关键辅音处存在约 140ms 同步异常</p></div><div><span>03</span><b>紧急借款</b><p>熟人身份加紧迫情境是高危组合</p></div>';
    $('#actionStrip').innerHTML = state.mode === 'elder'
      ? '<button class="danger-action">立即挂断</button><button>联系家人</button><button>拨打 96110</button>'
      : '<button class="danger-action">暂停转账</button><button>暗号核验</button><button>查看伪造痕迹</button>';
  } else {
    $('#riskNumber').textContent = '67';
    $('#riskTag').textContent = '疑似风险 · 待核';
    $('#resultTitle').textContent = state.mode === 'elder' ? '可能是正常社区通知，但需要确认' : '内容基本正常，但建议核实来源';
    $('#resultSubtitle').textContent = 'AI 对“身份证 / 上传”等词较敏感，当前信息不足。';
    $('#riskTag').style.cssText = 'color:var(--warning);background:rgba(255,199,92,.1);border-color:rgba(255,199,92,.25)';
    $('.score-progress').style.stroke = 'var(--warning)';
    $('.score-progress').style.strokeDashoffset = '105';
    $('#evidenceGrid').innerHTML = state.mode === 'elder'
      ? '<div><span>01</span><b>敏感信息</b><p>提到了携带身份证，触发隐私风险规则</p></div><div><span>02</span><b>线下地点</b><p>地点为熟悉的社区居委会，风险降低</p></div><div><span>03</span><b>没有付款</b><p>未要求转账或索取验证码</p></div>'
      : '<div><span>01</span><b>上传文件</b><p>涉及文件上传，触发账号安全检查</p></div><div><span>02</span><b>校内场景</b><p>时间与地点符合已知组会安排</p></div><div><span>03</span><b>无凭证索取</b><p>没有要求密码、验证码或付款</p></div>';
    $('#actionStrip').innerHTML = '<button class="danger-action" style="background:var(--warning)">独立核实</button><button>补充背景</button><button>查看判断依据</button>';
  }
}

function formatRecordingTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function startRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return;
  try {
    const recognition = new Recognition();
    state.recognition = recognition;
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    let confirmedText = '';
    recognition.onresult = event => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) confirmedText += text;
        else interimText += text;
      }
      $('#voiceTranscript').value = `${confirmedText}${interimText}`;
      state.voiceContent = $('#voiceTranscript').value.trim();
    };
    recognition.onerror = () => { /* 录音仍继续，用户可以手动修正文字。 */ };
    recognition.start();
  } catch (_) { /* 某些浏览器不支持同时录音与实时转写。 */ }
}

async function startRecording() {
  if (state.mediaStream) return;
  $('#micError').hidden = true;
  $('#voiceReady').hidden = true;
  $('#voiceTranscript').value = '';
  state.voiceContent = '';
  $('#voiceButton').classList.add('recording');
  $('#voiceHint').textContent = '请允许使用麦克风';
  $('#voiceSubHint').textContent = '允许后会自动开始，录音由您亲自确认停止';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaStream = stream;
    if (window.MediaRecorder) {
      state.mediaRecorder = new MediaRecorder(stream);
      state.mediaRecorder.start();
    }
    state.recordingStartedAt = Date.now();
    state.recordedSeconds = 0;
    $('#recordingTimer').textContent = '00:00';
    $('#voiceStage').classList.remove('is-ready');
    $('#voiceStage').classList.add('is-recording');
    $('#recordingConsole').hidden = false;
    $('.recording-status').hidden = false;
    $('.audio-bars').hidden = false;
    $('.recording-actions').hidden = false;
    $('#voiceButton').classList.add('recording');
    $('#analyzeButton').disabled = true;
    $('#analyzeButton span').textContent = '请先确认停止录音';
    state.recordingTimer = window.setInterval(() => {
      state.recordedSeconds = Math.floor((Date.now() - state.recordingStartedAt) / 1000);
      $('#recordingTimer').textContent = formatRecordingTime(state.recordedSeconds);
    }, 500);
    startRecognition();
  } catch (_) {
    $('#voiceButton').classList.remove('recording');
    $('#micError').hidden = false;
    $('#recordingConsole').hidden = false;
    $('#voiceStage').classList.add('is-recording');
    $('.recording-status').hidden = true;
    $('.audio-bars').hidden = true;
    $('.recording-actions').hidden = true;
    $('#voiceTranscript').focus();
    $('#analyzeButton').disabled = false;
    $('#analyzeButton span').textContent = '输入完成，开始核验';
  }
}

function stopRecording(confirmed = true) {
  if (state.recordingTimer) window.clearInterval(state.recordingTimer);
  state.recordingTimer = null;
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop();
  if (state.recognition) {
    try { state.recognition.stop(); } catch (_) { /* 已停止 */ }
  }
  if (state.mediaStream) state.mediaStream.getTracks().forEach(track => track.stop());
  state.mediaRecorder = null;
  state.mediaStream = null;
  state.recognition = null;
  $('#voiceButton').classList.remove('recording');
  $('#voiceStage').classList.remove('is-recording');

  if (confirmed) {
    state.voiceContent = $('#voiceTranscript').value.trim();
    $('#voiceStage').classList.add('is-ready');
    $('#recordingConsole').hidden = false;
    $('#voiceReady').hidden = false;
    $('#voiceReadySummary').textContent = `已录制 ${formatRecordingTime(state.recordedSeconds)}，可修改上方文字`;
    $('#voiceHint').textContent = '语音已经收到';
    $('#voiceSubHint').textContent = '请检查文字，确认无误后开始核验';
    $('#analyzeButton').disabled = false;
    $('#analyzeButton span').textContent = '确认内容，开始核验';
  } else {
    $('#voiceStage').classList.remove('is-ready');
    $('#recordingConsole').hidden = true;
    $('#voiceReady').hidden = true;
    $('#voiceTranscript').value = '';
    $('#voiceHint').textContent = '点击麦克风，开始说话';
    $('#voiceSubHint').textContent = '录音不会自动结束，由您亲自确认停止';
    $('#analyzeButton').disabled = false;
    $('#analyzeButton span').textContent = '开始智能核验';
  }
}

function openReview(forceSafe = false) {
  if (forceSafe) {
    state.sample = 'safe';
    $$('.sample').forEach(s => s.classList.toggle('active', s.dataset.sample === 'safe'));
  }
  $('#reviewDrawer').classList.add('open');
  $('#reviewDrawer').setAttribute('aria-hidden', 'false');
  $('#drawerBackdrop').classList.add('open');
  goReviewStep(1);
}

function closeReview() {
  $('#reviewDrawer').classList.remove('open');
  $('#reviewDrawer').setAttribute('aria-hidden', 'true');
  $('#drawerBackdrop').classList.remove('open');
}

function goReviewStep(step) {
  $$('.review-step').forEach(s => s.classList.toggle('active', s.dataset.reviewStep === String(step)));
  $$('.review-progress span').forEach((s, i) => s.classList.toggle('active', i < step));
  $('#reviewStepLabel').textContent = `${step} / 3 ${['补充情境','独立复核','结果与反馈'][step-1]}`;
}

function renderScenario() {
  const list = scenarioCopy[state.mode];
  const item = list[state.scenario % list.length];
  $('#callerAvatar').textContent = item.avatar;
  $('#callerType').textContent = item.type;
  $('#callerName').textContent = item.name;
  $('#callQuote').textContent = item.quote;
  $('#decisionQuestion').textContent = item.question;
  $('#scenarioTitle').textContent = state.mode === 'elder' ? '如果这一通电话打给你……' : '如果视频里出现“熟悉的人”……';
  $('#shieldScore').textContent = state.score;
  $$('#decisionList button').forEach((button, index) => {
    button.className = '';
    button.disabled = false;
    button.querySelector('b').textContent = item.choices[index][0];
    button.querySelector('small').textContent = item.choices[index][1];
  });
  $('#scenarioFeedback').hidden = true;
}

function scenarioChoice(button) {
  const type = button.dataset.choice;
  $$('#decisionList button').forEach(b => b.disabled = true);
  button.classList.add(type === 'good' ? 'chosen-good' : 'chosen-bad');
  const good = type === 'good';
  state.score = Math.min(100, Math.max(0, state.score + (good ? 30 : type === 'maybe' ? 5 : -15)));
  $('#shieldScore').textContent = state.score;
  $('#feedbackTitle').textContent = good ? '正确：先脱离对方控制' : type === 'maybe' ? '有警惕，但仍在对方的情境里' : '危险：画面和身份都可能被伪造';
  $('#feedbackText').textContent = good
    ? '切断当前渠道，再自行寻找官方号码或另一种联系方式，才能形成真正的独立核验。'
    : type === 'maybe'
      ? '骗子可以准备假警号或完整剧本。最安全的做法仍是挂断，再从官方渠道重新联系。'
      : '屏幕共享、转账或验证码一旦交出，损失可能立即发生。先暂停动作，再找可信渠道核验。';
  $('.feedback-icon').textContent = good ? '✓' : '!';
  $('.feedback-icon').style.background = good ? 'var(--mint)' : 'var(--warning)';
  $('#scenarioFeedback').hidden = false;
}

function openModal(name) {
  const modal = $(`#${name}Modal`);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  $('#modalBackdrop').classList.add('open');
}

function closeModals() {
  $$('.modal').forEach(m => { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); });
  $('#modalBackdrop').classList.remove('open');
}

function toast(message) {
  $('#toast p').textContent = message;
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 1800);
}

$$('.mode-btn').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
$$('[data-go="home"]').forEach(btn => btn.addEventListener('click', () => showScreen('home')));
$('#startMainCheck').addEventListener('click', () => showScreen('check'));
$('#startScenario').addEventListener('click', () => { renderScenario(); showScreen('scenario'); });
$$('[data-action="check"]').forEach(btn => btn.addEventListener('click', () => showScreen('check')));
$$('[data-action="scenario"]').forEach(btn => btn.addEventListener('click', () => { renderScenario(); showScreen('scenario'); }));
$$('[data-action="review-demo"]').forEach(btn => btn.addEventListener('click', () => { showScreen('check'); resetAnalysis(); state.sample = 'safe'; $$('.sample').forEach(s => s.classList.toggle('active', s.dataset.sample === 'safe')); setTimeout(runAnalysis, 250); setTimeout(() => openReview(true), 2200); }));

$$('.sample').forEach(btn => btn.addEventListener('click', () => {
  state.sample = btn.dataset.sample;
  $$('.sample').forEach(s => s.classList.toggle('active', s === btn));
  resetAnalysis();
}));

$('#voiceButton').addEventListener('click', startRecording);
$('#confirmRecording').addEventListener('click', () => stopRecording(true));
$('#cancelRecording').addEventListener('click', () => stopRecording(false));
$('#recordAgain').addEventListener('click', () => {
  stopRecording(false);
  startRecording();
});
$('#voiceTranscript').addEventListener('input', event => {
  state.voiceContent = event.target.value.trim();
  if (!state.mediaStream) {
    $('#analyzeButton').disabled = !state.voiceContent;
    $('#analyzeButton span').textContent = state.voiceContent ? '确认内容，开始核验' : '请先说话或输入内容';
  }
});

$('#dropZone').addEventListener('click', () => { state.sample = 'fraud'; toast('已载入 AI 换脸借款演示样本'); });
$('#analyzeButton').addEventListener('click', runAnalysis);
$('#disagreeButton').addEventListener('click', () => openReview());
$('#drawerBackdrop').addEventListener('click', closeReview);
$('.drawer-close').addEventListener('click', closeReview);
$('.drawer-done').addEventListener('click', () => { closeReview(); toast('感谢反馈，判断依据已更新'); });

$$('.context-options button').forEach(btn => btn.addEventListener('click', () => {
  $$('.context-options button').forEach(b => b.classList.toggle('selected', b === btn));
  $('[data-review-next="2"]').disabled = false;
}));
$('[data-review-next="2"]').addEventListener('click', () => goReviewStep(2));
$('#finishReview').addEventListener('click', () => goReviewStep(3));
$$('[data-feedback]').forEach(btn => btn.addEventListener('click', () => {
  $$('[data-feedback]').forEach(b => b.classList.toggle('selected', b === btn));
  $('#feedbackThanks').textContent = '已记录。只保留风险特征与纠错标签，不保存原始内容。';
}));

$$('#decisionList button').forEach(btn => btn.addEventListener('click', () => scenarioChoice(btn)));
$('#nextScenario').addEventListener('click', () => { state.scenario += 1; renderScenario(); });

$$('[data-open]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.open)));
$$('.modal-close').forEach(btn => btn.addEventListener('click', closeModals));
$('#modalBackdrop').addEventListener('click', closeModals);

$$('#actionStrip, .action-strip').forEach(strip => strip.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) toast(`${button.textContent}：已进入安全处理流程`);
}));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeReview(); closeModals(); }
});

setMode('elder');

