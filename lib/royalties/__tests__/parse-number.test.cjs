const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadParseNumber() {
  const filePath = path.join(__dirname, "..", "normalizer.js");
  const source = fs.readFileSync(filePath, "utf8");
  const sanitized = source.replace(/export\s+/g, "");
  const script = new vm.Script(`${sanitized}\nmodule.exports = { parseNumber };`, {
    filename: "normalizer.js",
  });
  const context = {
    module: { exports: {} },
    exports: {},
    require,
    console,
    process,
  };
  vm.createContext(context);
  script.runInContext(context);
  return context.module.exports.parseNumber;
}

const parseNumber = loadParseNumber();

test("treats parenthesized values as negative numbers", () => {
  assert.equal(parseNumber("(123.45)"), -123.45);
});

test("strips currency symbols and thousands separators inside parentheses", () => {
  assert.equal(parseNumber("($1,234.56)"), -1234.56);
});

test("handles quoted parenthesized amounts", () => {
  assert.equal(parseNumber('"($987.65)"'), -987.65);
});

test("preserves hyphenated negative numbers", () => {
  assert.equal(parseNumber("-321.09"), -321.09);
});

test("continues to sanitize percentage strings", () => {
  assert.equal(parseNumber("12.5%"), 12.5);
});
