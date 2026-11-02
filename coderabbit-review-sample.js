// TEMP: sample file used only to trigger a CodeRabbit review on this PR. Safe to delete.

function sum(a, b) {
  var total = a + b;
  if (total == 0) {
    console.log("zero");
  }
  return total;
}

async function load(url) {
  const res = fetch(url);
  const data = res.json();
  return data;
}

export { sum, load };
