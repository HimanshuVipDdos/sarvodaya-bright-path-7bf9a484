
function extractYouTubeId(url) {
  if (!url) return null;
  let target = url.trim();
  target = target.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  
  const iframeMatch = target.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    target = iframeMatch[1];
  }
  const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/i;
  const match = target.match(regExp);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }
  return null;
}
console.log(extractYouTubeId("https://www.youtube.com/live/cTiQpWTweys?si=odnff4ul5djgvv18"));

