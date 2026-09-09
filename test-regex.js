
function extractYouTubeId(url) {
  if (!url) return null;
  let target = url.trim();
  target = target
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  if (/^[a-zA-Z0-9_-]{11}$/.test(target)) {
    return target;
  }

  const iframeMatch = target.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    target = iframeMatch[1];
  }

  const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/i;
  const match = target.match(regExp);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }

  try {
    const parsed = new URL(target.startsWith("http") ? target : `https://${target}`);
    const v = parsed.searchParams.get("v");
    if (v && v.length === 11) {
      return v;
    }
  } catch {
    // ignore
  }

  return null;
}

const tests = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=10s",
  "https://youtu.be/dQw4w9WgXcQ?si=123",
  "https://www.youtube.com/live/cTiQpWTweys?si=odnff4ul5djgvv18",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  "dQw4w9WgXcQ",
  '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=123" frameborder="0"></iframe>',
  '&quot;https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=30&quot;'
];

tests.forEach((t) => {
  console.log(t.slice(0, 45).padEnd(45), '->', extractYouTubeId(t));
});

