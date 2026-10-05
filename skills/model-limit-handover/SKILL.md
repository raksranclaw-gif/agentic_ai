---
name: Model-limit handover
description: >-
  Use when launching or steering a long cloud-agent or model run, when usage
  limits may interrupt work, or when the user asks for a handover strategy so a
  stalled run can resume without starting over.
---
# Model-limit handover

## Before launch
1. Prefer an **included** usage model for long or uncertain jobs. Only pick an on-demand / paid model when the user named it or a standing rule requires it (e.g. hard 3D → Opus).
2. Put the full brief, hold constraints, deliverable paths, and success metrics in the launch prompt so a later agent can resume from files alone.
3. Attach a self-contained snapshot (tarball, stills, metrics) so the next run does not need the prior chat.

## Checkpoint contract (tell every long-running agent this)
Write a living file at a fixed path, e.g. `/opt/cursor/artifacts/HANDOVER.md` (or `HANDOVER.md` at the scene root), and **update it after every meaningful step**. Commit to the draft repo after each checkpoint.

Each update must include:
- **Goal** and tag name
- **Done**: completed steps with file paths
- **State**: current metrics vs targets (short table)
- **Root cause hypotheses** tested and result
- **Next 1–3 concrete steps** (not a restatement of the whole brief)
- **How to resume**: exact commands, branch/commit, patch path if any
- **Do not redo**: finished work to skip

Also dump interim artifacts whenever they exist: `metrics.json`, stills, and a rolling `partial.patch` that applies with `patch -p1` against the original snapshot.

## Mid-run self-check
At natural milestones (after diagnosis, after first solver pass, before long capture loops):
- If the run is on a **metered / on-demand** model, assume interruption is likely.
- Prefer finishing a checkpoint + commit over starting a new exploratory branch.
- If the tool reports a usage / quota / on-demand error, **stop exploring**, flush HANDOVER.md + partial.patch, then exit cleanly so a follow-up can resume.

## On interrupt or error revival
1. Read `HANDOVER.md` and the latest partial patch/artifacts first.
2. Resume from **Next steps**; never re-extract or re-diagnose finished work unless HANDOVER says the diagnosis was wrong.
3. If the previous model is blocked (quota), switch to the user’s chosen included model and pass HANDOVER.md + artifacts in the new launch.
4. Unwatch dead agents that cannot continue; keep one active handoff chain.

## Reporting to humans
Tell the user once when a limit blocks progress, with the concrete next choice (raise limit vs continue on included). Do not restart the whole task from zero in that message — point at the checkpoint.
