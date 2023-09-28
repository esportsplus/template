### TLDR

- I prefer to stay as close to the language as possible, this repo uses template literals only
- I ran out of time to clean things up so ignore the `// @ts-ignore` / `as` types everywhere
- First pass `render.ts` renders the template to screen, effects are meant to take over from there ( see battler repo )
- I believe a bottleneck comes from defining `getters`/`setters` in reactive objects https://github.com/esportsplus/reactivity/blob/main/src/reactive/object.ts#L53
  - Reactivity is a modified version of modderme's repo
  - This ( reactive object with getters/setters) is the API style I love, is there a more efficient way to do this while keeping the same API?
  - ^ Without manually creating getters/setters for each reactive object.
  - If this is a problem I'll likely work with `ts-macro` to generate a reactive object with getters/setters at build time.
    - I'm not against build time solutions if they are framework agnostic. If there is a build time anything that could boost load/performance without being tied to a framework I'm all ears.
- When you see a tagged template literal with a closure in it that means it will be rendered using an effect, otherwise reactive values are just read normally during render.
- Uses delegated events system I found in solidjs except I use a symbol instead of `$$x` ( forgot exact variable ) used by solid
- `attribute.ts`
  - `attribute` method manages element attributes with normal values
  - `list` methods manages class and style values ( each contain a list of values )
    - I've seen voby and other frameworks use `classlist.toggle`
    - I like having the ability to set/use multiple effects for both class/style. It makes it easier to keep systems separate ( see [battler/src/app/components/battle/monster.ts](https://github.com/ICJR/battler/blob/main/src/app/components/battle/monster.ts#L60) as an example )

### Battler

- `npm i && npm run dev`