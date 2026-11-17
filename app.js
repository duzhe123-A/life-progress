"use strict";

const ui = Object.fromEntries([
  "settings", "birthday", "baseline", "example-label", "form-error", "stage", "today", "today-value",
  "age-label", "years", "age-remainder", "lived", "year-bar", "life-bar", "year-number", "life-number",
  "year-note", "life-note", "themes", "journey", "milestones", "baseline-point", "play", "play-label", "back-today"
].map(id => [id, document.getElementById(id)]));

const number = new Intl.NumberFormat("zh-CN");
const playbackDuration = 12000;
let birthday = LifeCalendar.parseISO(ui.birthday.value);
let baseline = Number(ui.baseline.value);
let timeline;
let previewDay = null;
let playbackFrame = null;

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function renderProgress(bar, value, percentage) {
  const displayed = percentage >= 100 ? "100.0" : Math.min(99.9, percentage).toFixed(1);
  setText(value, displayed);
  bar.style.setProperty("--fraction", String(percentage / 100));
  bar.setAttribute("aria-valuenow", displayed);
  bar.setAttribute("aria-valuetext", displayed + "%");
}

function syncTimeline(now) {
  const today = LifeCalendar.fromLocalDate(now);
  const todayDay = LifeCalendar.toDay(today);
  if (timeline?.today === todayDay) return;
  const birth = LifeCalendar.toDay(birthday);
  const target = LifeCalendar.dayAtAge(birthday, baseline);
  const adult = LifeCalendar.dayAtAge(birthday, 18);
  timeline = { birth, today: todayDay, adult, baseline: target, end: Math.max(todayDay, target) };
  ui.birthday.max = LifeCalendar.toISO(today);
  ui.journey.min = String(birth);
  ui.journey.max = String(timeline.end);
  ui.milestones.querySelector('[data-point="adult"]').hidden = adult > timeline.end || adult === target;
  setText(ui["baseline-point"], baseline + " 岁");
  ui["baseline-point"].title = "寿命基准 " + baseline + " 岁";
}

function render() {
  const now = new Date();
  syncTimeline(now);
  const selected = previewDay ?? timeline.today;
  const simulated = previewDay !== null;
  const data = LifeCalendar.calculate(birthday, baseline, simulated ? LifeCalendar.localDateAtDay(selected) : now);
  const iso = LifeCalendar.toISO(data.today);

  document.body.classList.toggle("simulating", simulated);
  ui["back-today"].hidden = !simulated;
  ui.today.dateTime = iso;
  setText(ui["today-value"], iso.replaceAll("-", "."));
  setText(ui["age-label"], simulated ? "推演年龄" : "当前年龄");
  setText(ui.years, String(data.age.years));
  setText(ui["age-remainder"], data.age.months + " 个月 " + data.age.days + " 天");
  setText(ui.lived, (simulated ? "距出生 " : "已走过 ") + number.format(data.livedDays) + " 天");
  renderProgress(ui["year-bar"], ui["year-number"], data.yearPercent);
  renderProgress(ui["life-bar"], ui["life-number"], data.lifePercent);
  setText(ui["year-note"], "已过 " + data.yearElapsed + " / " + data.yearDays + " 天");
  setText(ui["life-note"], (data.reachedBaseline ? "已达到 " : "以 ") + baseline + (data.reachedBaseline ? " 岁基准" : " 岁为基准"));

  ui.journey.value = String(selected);
  ui.journey.style.setProperty("--journey", (selected - timeline.birth) / (timeline.end - timeline.birth) * 100 + "%");
  ui.journey.setAttribute("aria-valuetext", iso + " · " + data.age.years + " 岁");
  for (const button of ui.milestones.querySelectorAll("button[data-point]")) {
    button.setAttribute("aria-pressed", String(timeline[button.dataset.point] === selected));
  }
}

function animate() {
  ui.stage.classList.remove("reveal");
  void ui.stage.offsetWidth;
  ui.stage.classList.add("reveal");
}

function invalid(field, message) {
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", "form-error");
  ui["form-error"].textContent = message;
  ui["form-error"].hidden = false;
  field.focus();
  return false;
}

function applySettings() {
  ui["form-error"].hidden = true;
  for (const field of [ui.birthday, ui.baseline]) {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  }
  const candidate = LifeCalendar.parseISO(ui.birthday.value);
  const today = LifeCalendar.fromLocalDate(new Date());
  if (!candidate) return invalid(ui.birthday, "请输入完整的出生年月日。");
  if (LifeCalendar.toDay(candidate) > LifeCalendar.toDay(today)) return invalid(ui.birthday, "出生日期不能晚于今天。");
  const candidateBaseline = Number(ui.baseline.value);
  if (!Number.isInteger(candidateBaseline) || candidateBaseline < 1 || candidateBaseline > 150) {
    return invalid(ui.baseline, "寿命基准请输入 1 到 150 之间的整数。");
  }
  birthday = candidate;
  baseline = candidateBaseline;
  timeline = null;
  ui["example-label"].hidden = true;
  return true;
}

function stopPlayback() {
  if (playbackFrame !== null) cancelAnimationFrame(playbackFrame);
  playbackFrame = null;
  ui.play.setAttribute("aria-pressed", "false");
  setText(ui["play-label"], "播放人生");
  setText(ui.play.querySelector(".play-icon"), "▷");
}

function seek(day) {
  stopPlayback();
  ui.stage.classList.remove("reveal");
  previewDay = day === timeline.today ? null : day;
  render();
}

function returnToday() {
  seek(timeline.today);
}

function startPlayback() {
  if (playbackFrame !== null) {
    stopPlayback();
    return;
  }
  const edited = ui.birthday.value !== LifeCalendar.toISO(birthday) || Number(ui.baseline.value) !== baseline;
  if (edited && !applySettings()) return;
  syncTimeline(new Date());
  const { birth: firstDay, baseline: lastDay } = timeline;
  ui.stage.classList.remove("reveal");
  ui.play.setAttribute("aria-pressed", "true");
  setText(ui["play-label"], "停止播放");
  setText(ui.play.querySelector(".play-icon"), "◼");
  const start = performance.now();
  let lastUpdate = -Infinity;
  previewDay = firstDay;
  render();
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  ui.stage.scrollIntoView({ block: "nearest", behavior });
  function advance(now) {
    const fraction = Math.min(1, (now - start) / playbackDuration);
    if (now - lastUpdate > 55 || fraction === 1) {
      previewDay = Math.round(firstDay + fraction * (lastDay - firstDay));
      lastUpdate = now;
      render();
    }
    if (fraction < 1) playbackFrame = requestAnimationFrame(advance);
    else stopPlayback();
  }
  playbackFrame = requestAnimationFrame(advance);
}

ui.settings.addEventListener("submit", event => {
  event.preventDefault();
  if (!applySettings()) return;
  stopPlayback();
  previewDay = null;
  render();
  animate();
});
ui.journey.addEventListener("input", () => seek(Number(ui.journey.value)));
ui.milestones.addEventListener("click", event => {
  const button = event.target.closest("button[data-point]");
  if (button) seek(timeline[button.dataset.point]);
});
ui.themes.addEventListener("click", event => {
  const selected = event.target.closest("button[data-theme]");
  if (!selected) return;
  document.body.dataset.scene = selected.dataset.theme;
  for (const button of ui.themes.querySelectorAll("button[data-theme]")) {
    button.setAttribute("aria-pressed", String(button === selected));
  }
});
ui.play.addEventListener("click", startPlayback);
ui["back-today"].addEventListener("click", returnToday);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopPlayback();
  else render();
});

render();
animate();
setInterval(render, 30000);
