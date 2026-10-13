# Third-party sources and attribution

The top-level [Apache License 2.0](LICENSE) applies to original Cognium and
contributor material. It does not replace the licences of the third-party
materials identified here. Normative standards text remains at its source; the
repository retains only the fields or examples needed for traceability and
repeatable testing.

## Material map

| Repository material | Source | Treatment | Licence |
|---|---|---|---|
| `wcag/criteria.json` | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the [W3C WCAG source repository](https://github.com/w3c/wcag) | Mechanically reduced to criterion number, name, level, principle and guideline placement; normative prose is not vendored | [W3C Document License 2023](https://www.w3.org/copyright/document-license-2023/) |
| `act/testcases.json` | [W3C ACT Rules test-case catalogue](https://www.w3.org/WAI/standards-guidelines/act/report/testcases/) | Stored as an upstream catalogue snapshot; individual test cases remain at their source URLs | [W3C Software and Document License](https://act-rules.github.io/pages/license/) |
| `patterns.mjs`, `patterns.json`, `patterns/` | [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) | Original matched fixtures informed by APG pattern and keyboard guidance; not represented as normative APG examples | [W3C Software and Document License 2023](https://www.w3.org/copyright/software-license-2023/) |
| `taxonomy.mjs`, `taxonomy/user-needs.json` | [WAI abilities and barriers guidance](https://www.w3.org/WAI/people-use-web/abilities-barriers/) | Functional-needs labels and organization are summarized and restructured for benchmark indexing | [W3C Document License 2023](https://www.w3.org/copyright/document-license-2023/) |
| Methodology citations in `FOUNDATION.md` and `README.md` | [WCAG-EM](https://www.w3.org/TR/WCAG-EM/) and other linked W3C publications | Links and short factual references only; no local normative copy | Applicable W3C document terms at each source |

### Modification notices

- This software or document includes material copied from or derived from
  *Web Content Accessibility Guidelines (WCAG) 2.2*,
  <https://www.w3.org/TR/WCAG22/>. Copyright © 2023 W3C®. The local index is a
  non-normative mechanical transformation and records its extraction date.
- This software or document includes material copied from or derived from the
  *W3C ACT Rules test-case catalogue*,
  <https://www.w3.org/WAI/standards-guidelines/act/report/testcases/>. Copyright
  © 2026 W3C®. The local JSON is a pinned upstream snapshot; benchmark-specific
  metrics are calculated separately.
- This software or document includes material copied from or derived from the
  *WAI-ARIA Authoring Practices Guide*, <https://www.w3.org/WAI/ARIA/apg/>.
  Copyright © 2026 W3C®. The repository's paired fixtures are newly authored,
  simplified test shapes and are not normative APG examples.
- This software or document includes material copied from or derived from
  *How People with Disabilities Use the Web: Abilities and Barriers*,
  <https://www.w3.org/WAI/people-use-web/abilities-barriers/>. Copyright © 2023
  W3C®. The local taxonomy restructures the source into stable functional
  identifiers and benchmark scenarios.

## W3C Software and Document Notice and License

This work is being provided by the copyright holders under the following license.

By obtaining and/or copying this work, you (the licensee) agree that you have
read, understood, and will comply with the following terms and conditions.

Permission to copy, modify, and distribute this work, with or without
modification, for any purpose and without fee or royalty is hereby granted,
provided that you include the following on ALL copies of the work or portions
thereof, including modifications:

- The full text of this NOTICE in a location viewable to users of the
  redistributed or derivative work.
- Any pre-existing intellectual property disclaimers, notices, or terms and
  conditions. If none exist, the
  [W3C software and document short notice](https://www.w3.org/Consortium/Legal/2023/copyright-software-short-notice.html)
  should be included.
- Notice of any changes or modifications, through a copyright statement on the
  new code or document such as: “This software or document includes material
  copied from or derived from [title and URI of the W3C document]. Copyright ©
  [year-of-document] World Wide Web Consortium.
  https://www.w3.org/copyright/software-license-2023/”

THIS WORK IS PROVIDED “AS IS,” AND COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS OR
WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
MERCHANTABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
WORK WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER
RIGHTS.

COPYRIGHT HOLDERS WILL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, SPECIAL OR
CONSEQUENTIAL DAMAGES ARISING OUT OF ANY USE OF THE WORK.

The name and trademarks of copyright holders may NOT be used in advertising or
publicity pertaining to the work without specific, written prior permission.
Title to copyright in this work will at all times remain with copyright holders.

Canonical notice: <https://www.w3.org/copyright/software-license-2023/>.

## W3C Document License summary and implementation notice

Public documents on the W3C site are provided by the copyright holders under
the following licence.

By using and/or copying a document, the licensee agrees to comply with the
licence. Permission to copy and distribute the contents in any medium for any
purpose and without fee or royalty is granted provided that all copies include:

- a link or URL to the original W3C document;
- the pre-existing copyright notice, or a notice naming the document year and
  World Wide Web Consortium with the document-licence URL; and
- the status of the W3C document, if it exists.

The licence does not generally grant a right to create modifications or
derivatives. To facilitate implementation of technical specifications,
derivative works and portions may be distributed in software, supporting
materials and software documentation when they carry a notice identifying the
source W3C document. Derivative publication as a competing technical
specification is prohibited. Clearly marked code components are governed by the
W3C Software License.

W3C documents are provided “as is,” without warranties of merchantability,
fitness for a particular purpose, non-infringement or title. Copyright holders
are not liable for direct, indirect, special or consequential damages. W3C names
and trademarks may not be used in advertising or publicity without specific
written permission.

Required implementation notice:

> Copyright © 2023 W3C®. This software or document includes material copied
> from or derived from the W3C documents identified in the material map above.

Canonical licence text:
<https://www.w3.org/copyright/document-license-2023/>.

## Other dependencies and names

Packages installed from `check/package-lock.json` and container images referenced
by the Docker configuration are not vendored into the source repository. Their
own licences govern those distributions. Individual tool and platform names may
appear for interoperability and research purposes. Their owners do not sponsor
or endorse this corpus unless they explicitly say so.
