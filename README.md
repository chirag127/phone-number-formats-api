# Phone Number Formats API

Per-country phone validation rules for all 254 territories in libphonenumber's metadata —
calling code, national prefix, digit lengths, example number and national/international
formats — served as free static JSON.

No authentication. No server. No rate limit. The committed JSON is the database. Refreshed
automatically by GitHub Actions from the libphonenumber metadata.

    curl https://chirag127.github.io/phone-number-formats-api/api/v1/countries.json

## What you get

| Field | Example | Notes |
|---|---|---|
| `isoCountry` | `"US"` | ISO 3166-1 alpha-2 code; nine non-geographic entries carry `"001"` and are filed under `001-<callingCode>.json` |
| `callingCode` | `1` | ITU-T E.164 country calling code as an integer |
| `nationalPrefix` | `"1"` | Digit dialled before a national number, or `null` when the territory has none |
| `digits` | `[10]` | Every valid national number length (expanded from possibleLengths, sorted) |
| `digitsMin` / `digitsMax` | `10` / `10` | Shortest and longest valid national number |
| `exampleNumber` | `"2015550123"` | A valid national example from the metadata, or `null` |
| `nationalFormat` | `"(201) 555-0123"` | The example number run through the territory's first matching format pattern, or `null` |
| `internationalFormat` | `"201-555-0123"` | The international-format pattern applied to the example, or `null` |

## Endpoints

| Endpoint | Description | Size |
|---|---|---|
| `GET /api/v1/countries.json` | All 254 records (245 geographic + 9 non-geographic) | ~72 KB |
| `GET /api/v1/countries/{iso}.json` | One territory per file — 255 files, e.g. `US.json` or `001-881.json` for the non-geographic codes | ~300 B each |
| `GET /data/formats.json` | Same data as above (source of truth for the repo) | ~72 KB |

## How it stays fresh

The `update.yml` workflow runs weekly, fetches
[PhoneNumberMetadata.xml](https://raw.githubusercontent.com/google/libphonenumber/master/resources/PhoneNumberMetadata.xml)
from the libphonenumber project, regenerates the JSON and commits only when the data changed.
GitHub Pages serves the result.

## Data source and accuracy

The source is the
[PhoneNumberMetadata.xml](https://github.com/google/libphonenumber/blob/master/resources/PhoneNumberMetadata.xml)
maintained by Google's libphonenumber project — the same metadata that backs Android, iOS and
Java phone validation. All 254 territories are included: 245 geographic countries and 9
non-geographic codes (e.g. 800, 881, 882, 883). All 254 records carry an example number; 207
also carry a matching national and international format, which is limited by patterns that
compile as JavaScript regexes rather than Java ones. Digit lengths are taken from
`possibleLengths` at the national level.

## Limits, stated plainly

- 47 of 254 territories have no `nationalFormat`/`internationalFormat` — their metadata patterns are Java regexes that a JavaScript engine rejects, or the example predates the pattern. The raw validation fields are still complete for those.
- Patterns are not exposed; only the formatted result is. If you need full format-pattern data, use libphonenumber directly.
- Formats are illustrative (the example number shaped by the first matching pattern), not a guarantee that every real number matches.
- libphonenumber updates its metadata frequently, so expect a weekly commit most weeks.

## Licence

Data: libphonenumber's metadata is licensed under Apache License 2.0; this API republishes it
with attribution. Code: MIT.

---

## About the author

**Chirag Singhal** — building free, open APIs and tools. Everything here is free, no
authentication, no rate limits, no telemetry. If it saves you time and you want to work
together, that is exactly what this is for.

- **Email — the fastest way to reach me:** [chirag@oriz.in](mailto:chirag@oriz.in)
- **GitHub:** [github.com/chirag127](https://github.com/chirag127)
- **LinkedIn:** [linkedin.com/in/chirag127](https://www.linkedin.com/in/chirag127/)
- **X:** [x.com/singhal127](https://x.com/singhal127)
- **YouTube:** [@ChiragSinghal127](https://www.youtube.com/@ChiragSinghal127)
- **Instagram:** [chiragsinghal127](https://www.instagram.com/chiragsinghal127/)
- **Reddit:** [Far_Macaron_9910](https://www.reddit.com/user/Far_Macaron_9910/)
- **Buy me a coffee:** [buymeacoffee.com/chirag127](https://buymeacoffee.com/chirag127)

**Hiring?** I build developer tooling, data APIs and web platforms. Email me — I reply to
everything.
