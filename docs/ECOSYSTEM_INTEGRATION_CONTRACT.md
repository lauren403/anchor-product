# Anchor ecosystem integration contract

## Product roles

| Surface | Role | Must not imply |
| --- | --- | --- |
| ADHD Hub | Discover and understand | Personalised clinical advice |
| Anchor | Find one bounded support for this moment | Monitoring, diagnosis or treatment |
| Body Belonging Clinic | Seek professional support when wanted | That Anchor entries are visible to the clinic |

## Hub → Anchor

Preferred deep link:

```text
https://<anchor-domain>/#moment=forgot-eat
```

Allowed moment identifiers are defined only in `lib/anchor/taxonomy.ts`. The fragment is interpreted on-device and is not part of the web request. Do not add names, free text, diagnosis status, medication information or outcomes to the URL.

Supported launch identifiers:

- `forgot-eat`
- `nothing-manageable`
- `cant-start`
- `lost-day`
- `too-loud`
- `reply-late`
- `rehearsing`
- `move-channel`
- `research-hype`

## Campaign → Anchor

The existing `?campaign=<approved-id>` contract remains supported. Campaign identifiers describe public creative, not a user's health state. If a moment and campaign arrive together, the moment finder takes priority and the moment query is removed.

## Anchor → Hub and clinic

Outbound ecosystem links:

- use fixed approved destinations;
- use `rel="noreferrer"`;
- may include only non-sensitive source/medium attribution;
- never include moment, barrier, capacity, support, outcome, saved item or check-in data;
- open as an explicit user action.

## Measurement boundary

Permitted future aggregate events include page opened, recommendation flow started, support opened and generic outcome recorded, provided they are implemented through a privacy review and carry no health-state label. Meta must never receive Anchor moment, barrier, outcome, meal, check-in or appointment-preparation data.

## Required reciprocal changes before ecosystem launch

- Add a clearly labelled Anchor entry point to the ADHD Hub using the fragment contract.
- Add a clinic navigation or resource entry that describes Anchor as an emerging general wellbeing tool.
- Preserve distinct privacy and intended-purpose wording on all three surfaces.
- Test every reciprocal route in a non-production environment before live publication.
