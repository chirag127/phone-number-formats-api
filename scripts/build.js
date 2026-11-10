#!/usr/bin/env node
// Regenerates data/ and api/v1/ from libphonenumber's PhoneNumberMetadata.xml.
// No timestamp in the output: unchanged source data must produce byte-identical
// files, or the "commit only if changed" step in update.yml never settles.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL =
  'https://raw.githubusercontent.com/google/libphonenumber/master/resources/PhoneNumberMetadata.xml';
const ROOT = path.join(__dirname, '..');

// The metadata file writes regexes across wrapped lines and uses the odd Java
// construct; JS RegExp rejects some patterns, so every compile/match is
// best-effort and a failure leaves the formatted fields null rather than
// aborting the build. Whitespace is stripped before matching — the metadata
// regexes only ever match digits, and the XML line-wrapping is cosmetic.
function tryFormat(pattern, format, example, leadingDigits) {
  try {
    const re = new RegExp(`^(?:${pattern.replace(/\s+/g, '')})$`);
    if (!re.test(example)) return null;
    if (leadingDigits && leadingDigits.trim() && !new RegExp(`^(?:${leadingDigits.replace(/\s+/g, '')})`).test(example)) {
      return null;
    }
    return format.replace(/\$(\d)/g, (_, n) => {
      const m = example.match(re);
      return m[Number(n)] ?? '';
    });
  } catch {
    return null;
  }
}

// possibleLengths@national is a comma list where each part may be a range
// such as "7-9" — expand into explicit lengths.
function parseLengths(value) {
  const lengths = [];
  for (const part of value.split(',')) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++) lengths.push(n);
    } else if (/^\d+$/.test(part)) {
      lengths.push(Number(part));
    }
  }
  return [...new Set(lengths)].sort((a, b) => a - b);
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTerritory(xml) {
  const tagEnd = xml.indexOf('>');
  const attrs = {};
  for (const [, k, v] of xml.slice(0, tagEnd).matchAll(/(\w+)="([^"]*)"/g)) attrs[k] = v;
  const body = xml.slice(tagEnd + 1);

  // generalDesc.possibleLengths@national, e.g. "10" or "6,8,10" or "7-9".
  let digits = [];
  const pl = body.match(/<possibleLengths[^>]*national="([^"]*)"/);
  if (pl) digits = parseLengths(pl[1]);

  // First example number in canonical type order — fixedLine is preferred,
  // falling back to mobile and the other number types.
  let exampleNumber = null;
  for (const type of ['fixedLine', 'mobile', 'tollFree', 'premiumRate', 'sharedCost', 'personalNumber', 'voip', 'pager', 'uan', 'voicemail']) {
    const m = body.match(new RegExp(`<${type}>([\\s\\S]*?)</${type}>`));
    if (m) {
      const ex = m[1].match(/<exampleNumber>([^<]*)<\/exampleNumber>/);
      if (ex) {
        exampleNumber = ex[1].trim();
        break;
      }
    }
  }

  // Formats live in availableFormats; each numberFormat has a pattern (a Java
  // regex over the national significant number), a <format> national template,
  // an optional <intlFormat> template and an optional <leadingDigits> gate.
  let nationalFormat = null;
  let internationalFormat = null;
  const available = body.match(/<availableFormats>([\s\S]*?)<\/availableFormats>/);
  if (available && exampleNumber) {
    for (const nf of available[1].matchAll(/<numberFormat\b([^>]*?)(\/>|>([\s\S]*?)<\/numberFormat>)/g)) {
      const attrsNf = {};
      for (const [, k, v] of nf[1].matchAll(/(\w+)="([^"]*)"/g)) attrsNf[k] = v;
      const inner = nf[3] ?? '';
      const fmt = inner.match(/<format>([^<]*)<\/format>/);
      const intl = inner.match(/<intlFormat>([^<]*)<\/intlFormat>/);
      const lead = inner.match(/<leadingDigits>([^<]*)<\/leadingDigits>/);
      if (!fmt) continue;
      const national = tryFormat(attrsNf.pattern, decodeEntities(fmt[1]), exampleNumber, lead && decodeEntities(lead[1]));
      if (national === null) continue;
      if (!nationalFormat) nationalFormat = national;
      // libphonenumber semantics: a missing <intlFormat> child means the
      // national template is used internationally too; "NA" marks a
      // national-only format that must not be exported as international.
      if (internationalFormat === null && !intl) internationalFormat = national;
      if (internationalFormat === null && intl && intl[1].trim() !== 'NA') {
        internationalFormat = tryFormat(attrsNf.pattern, decodeEntities(intl[1]), exampleNumber, lead && decodeEntities(lead[1]));
      }
    }
  }

  return {
    isoCountry: attrs.id,
    callingCode: attrs.countryCode ? Number(attrs.countryCode) : null,
    nationalPrefix: attrs.nationalPrefix ?? null,
    digits,
    digitsMin: digits.length ? digits[0] : null,
    digitsMax: digits.length ? digits[digits.length - 1] : null,
    exampleNumber,
    nationalFormat,
    internationalFormat,
  };
}

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${SOURCE_URL}`);
  }
  const xml = (await res.text()).replace(/<!--[\s\S]*?-->/g, '');

  // Territory blocks never nest, so a start/end scan is a safe split.
  const records = [];
  let cursor = 0;
  for (;;) {
    const start = xml.indexOf('<territory ', cursor);
    if (start === -1) break;
    const end = xml.indexOf('</territory>', start);
    if (end === -1) throw new Error('Unterminated <territory> block');
    records.push(parseTerritory(xml.slice(start, end + '</territory>'.length)));
    cursor = end;
  }
  records.sort((a, b) => a.isoCountry.localeCompare(b.isoCountry));

  const write = (rel, data) => {
    const file = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  };

  const document = { generatedFrom: SOURCE_URL, count: records.length, records };
  // Drop the per-territory tree first so retired territories or renamed
  // files (e.g. the 001-<code> split) cannot linger as stale output.
  fs.rmSync(path.join(ROOT, 'api/v1/countries'), { recursive: true, force: true });
  write('data/formats.json', document);
  write('api/v1/countries.json', document);
  for (const record of records) {
    // Nine non-geographic codes all carry isoCountry "001"; suffix the
    // calling code so their per-territory files don't overwrite each other.
    const file = record.isoCountry === '001' ? `001-${record.callingCode}` : record.isoCountry;
    write(`api/v1/countries/${file}.json`, {
      generatedFrom: SOURCE_URL,
      count: 1,
      records: [record],
    });
  }

  const withFormats = records.filter((r) => r.nationalFormat || r.internationalFormat).length;
  const withExample = records.filter((r) => r.exampleNumber).length;
  const geo = records.filter((r) => r.isoCountry !== '001').length;
  console.log(
    `phone-number-formats: ${records.length} records written (${geo} geographic, ` +
      `${records.length - geo} non-geographic "001"); ` +
      `${withExample} with example numbers; ${withFormats} with at least one format`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
