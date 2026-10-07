# Orangegame project instructions

- This is a WeChat Mini Game built with Cocos Creator. Keep the engine version pinned to the version recorded in package.json.
- Use TypeScript for game scripts. The system Node.js installation is for development tools; Creator manages its own engine and build runtime.
- docs/spec.md is the canonical confirmed scope. The player runs a computer brand company, with independent product development and custom commissions. Preserve the full design-to-sales loop and flexible boutique, scale and mixed routes.
- The confirmed presentation is portrait, light cartoon hardware humor, a 2.5D isometric workshop and a close-up case design workbench. The rendering approach and detailed art rules remain open.
- The full timeline is 2016–2030. The Demo runs from January to June 2016 and targets 2–3 hours of content. Candidate hardware names, specific models, numbers and month-by-month sequencing remain design suggestions until approved.
- The Demo purchase catalog is fixed at 32 entries across the eight confirmed component categories. Keep color, panel and accessory customization outside the core entry count.
- Use formal supplier brands and product series on procurement cards, packaging and component stickers. Keep familiar nicknames in dialogue and news. docs/brands.md records display rules; docs/supplier-registry.md contains full-game placeholders and cross-category roles. Supplier registration does not expand the fixed 32-item Demo. Names have not undergone a name or trademark search. GPU board manufacturer, product series, graphics-platform brand and physical board variant are separate fields.
- The user authorized reasonable common-sense inference for missing connector evidence and exact revision supply dates. Keep those assumptions separate from verified manufacturer fields. Treat them as game design decisions rather than blockers. Registry brands introduced later must not be unlocked in January 2016 merely because they appear in the modern reference images.
- design/*.json contains draft reference specifications, brand registration, product series, original structural designs and provisional game balance. Keep their provenance separate. Validate changes with npm run check:design; a passing numerical check does not confirm workbench collision geometry or six-month business balance.
- Use player-triggered monthly settlement. Offline work completes existing schedules without advancing the calendar; online and offline progress share one accounting record. Preserve full custom designs in saves.
- The Demo is single-player with account association and cloud saves. It is free, with no ads, payments or paid acceleration. Do not add systems outside the confirmed scope while refining component data, economics, workbench interaction and art rules.
- Codex draws the main raster artwork with the built-in image generation tool. Keep final project assets and their generation prompts in this workspace.
- Figma is the requested tool for asset slicing. Preserve the source art, use consistent export names, and import approved exports into assets/art.
- Keep original artwork in art/source and prompt records in art/prompts. Do not import source art or design references into the runtime assets directory.
- Keep Cocos .meta files beside their assets and commit them with the assets. Preserve existing UUIDs when replacing an asset in place.
- Store machine-specific paths and local account settings under .local. Never commit credentials or private keys. AppSecret belongs only in backend configuration when required; never include it in game assets, client code, shared docs or tool output.
- Check the relevant spec before implementing features. Prefer a small playable prototype once the core gameplay is confirmed.
- Validate browser preview and WeChat builds separately. Report build, simulator and real-device results only when each has actually been checked.
