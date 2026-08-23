# Product Proposal

Chosen from the provided idea list: **Anonymous Feedback / Survey (verifiable participation, private responses).**

## What is the product, and who uses it?

An anonymous survey tool where even the person running the survey cannot tell who said what.

The creator defines an eligible group, such as a team roster, a class list, or a community's member directory, and shares a link. Each participant proves they belong to that group without revealing which member they are, and the contract enforces one response per person. Results stay sealed until a minimum number of responses arrive, so a small turnout cannot be narrowed back down to individuals.

The people who use it are the ones who already run surveys and get filtered answers back: engineering managers running team retros, lecturers collecting course evaluations, DAO and community organisers gathering opinions before a vote, and event organisers collecting post event feedback.

The reason honest feedback dies on existing platforms is not that people distrust the software vendor. It is that they distrust the person who will read the results, and they are right to. On Google Forms, Typeform, or SurveyMonkey the organiser can usually correlate answers through accounts, submission order, timestamps, or simply by knowing who was in the room. Everyone filling in a workplace survey knows this, so they write the safe version of what they think.

## Why Midnight specifically?

A transparent chain makes this worse rather than better. If every response is a public transaction from a wallet address, the link between person and answer is not just visible to the organiser, it is visible to everyone forever.

Midnight is a fit because the product needs two properties that normally trade off against each other:

1. **Verifiable participation.** Anyone can check that responses came from real, eligible members of the defined group, and that nobody submitted twice. This is a membership proof against a committed set, plus a nullifier published on chain so a second response from the same member is rejected.
2. **Unlinkable responses.** The response is disclosed. The identity behind it never is, and no party, including the organiser and including the contract, ever holds both halves.

That is exactly the shape of `disclose()` and private witnesses. The member's secret stays a witness on their own machine, the proof travels, and only the deliberately disclosed parts reach the ledger. The Level 1 to 3 guarded counter in this repo is a small version of the same pattern: a commitment goes public, the key behind it never does.

Worth being precise about the limit. This gives Sybil resistance **within a defined group**, not proof of personhood on the open internet. If the link were open to anyone, one response per person would collapse into one response per wallet, and wallets are free. Gating to a roster is what makes the guarantee real, and organisers already have the roster.

## Data Model

| Data Point | Type | Disclosed To |
|------------|------|--------------|
| Eligible member set, as a commitment | Public ledger | Everyone |
| Survey questions | Public ledger | Everyone |
| Member's private key / credential | Private witness | No one, never leaves the browser |
| Which member submitted a given response | Never computed or stored | No one, including the organiser |
| Response content | Private witness until the reveal threshold, then public | Everyone, unlinked from any member |
| Nullifier proving single use | Public ledger | Everyone |
| Response count | Public ledger | Everyone |
| Minimum reveal threshold | Public ledger | Everyone |

The row that carries the product is the fourth one. The link between a member and their answer is not encrypted or access controlled, it is never constructed in the first place.

## Mainnet Feasibility

**The cryptography is realistic.** Membership proofs against a committed set and nullifier based single use are well established patterns, and they are close to what is already compiling and deploying in this repo. Nothing here needs a novel circuit.

**The honest risk is network availability, not contract complexity.** Preprod has been unreachable for me across many attempts over several days, hanging at wallet sync before ever reaching a deploy, which is why Levels 2 and 3 are deployed and demonstrated on Preview instead. Midnight's own forum notes Preprod is mid reset for mainnet preparation and intermittently unavailable. If that persists into Level 6, reaching Mainnet becomes a scheduling problem rather than an engineering one.

**The second real constraint is wallet friction.** Every respondent needs a Lace wallet, which is a hard filter for a mainstream consumer survey audience. The realistic path to the Level 5 and 6 user targets is groups whose members already hold wallets, so the first cohorts are DAO and hackathon communities rather than classrooms. The classroom and workplace versions are the larger long term market, but they only open up once wallet onboarding gets easier.

**Scope for Level 4 to 6.** Level 4 delivers a single survey type, a fixed roster supplied at creation, one response per member, and a threshold gated reveal. Recurring surveys, richer question types, and credential based eligibility beyond an explicit roster are deliberately out of scope until the core loop has real users.
