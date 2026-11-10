This repo is a free static-JSON API for per-country phone validation rules — 254 territories
from libphonenumber's PhoneNumberMetadata.xml, each with calling code, national prefix, valid
digit lengths, example number and national/international formats. Served on GitHub Pages at
https://chirag127.github.io/phone-number-formats-api/. The weekly `update.yml` workflow
re-fetches the XML and commits only when the regenerated output differs. Never edit the JSON
under `data/` or `api/v1/` by hand — regenerate with `node scripts/build.js`.
