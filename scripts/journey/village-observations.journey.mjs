import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { loadFixturePair, assertExactNames } from '../mounted-parts.mjs'

const { fixture, manifest } = loadFixturePair('scripts/testdata/village-observations.yaml', 'scripts/testdata/village-observations.manifest.yaml', {cases:'requiredCaseNames',containmentCases:'requiredContainmentNames',containmentMotions:'requiredContainmentMotionNames'})
assertExactNames(fixture.containmentCollectiveIds,manifest.requiredContainmentCollectiveIds,'bounded host collective inventory')
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

for(const motion of fixture.containmentMotions)for(const row of fixture.containmentCases)for(const viewport of [fixture.scroll.desktop,fixture.scroll.mobile]){
  test(`bounded public host ${row.name} ${motion.name} ${viewport.width}`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:motion.value})
    await page.setViewportSize(viewport)
    await page.goto(`/iframe.html?id=in-use-village-observations--bounded-flex-host&viewMode=story&globals=theme:${info.project.name}&args=hostPosition:${row.hostPosition}`)
    const host=page.locator('.vobs-bounded-host')
    const panel=host.locator('.vobs > .tabpanel:visible')
    await expect(panel).toBeVisible()
    await page.evaluate(()=>document.fonts.ready)
    await panel.evaluate((node)=>Promise.allSettled(node.getAnimations().map(animation=>animation.finished)))
    const geometry=()=>page.evaluate(()=>{
      const host=document.querySelector('.vobs-bounded-host'),panel=host.querySelector('.vobs > .tabpanel:not([hidden])'),label=panel.querySelector('.sr-only')
      const rect=panel.getBoundingClientRect()
      return {viewportHeight:innerHeight,documentHeight:document.documentElement.scrollHeight,bodyHeight:document.body.scrollHeight,hostOverflow:getComputedStyle(host).overflowY,bodyOverflow:getComputedStyle(document.body).overflowY,panelOverflow:getComputedStyle(panel).overflowY,panelHeight:panel.clientHeight,panelScrollHeight:panel.scrollHeight,panelBottom:rect.bottom,labelParent:label?.offsetParent?.className,labelAnchoredToPanel:label?.offsetParent===panel,panelTransform:getComputedStyle(panel).transform,panelAnimation:getComputedStyle(panel).animationName,panelAnimationFill:getComputedStyle(panel).animationFillMode,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}
    })
    const before=await geometry()
    await info.attach(`${row.name}-${motion.name}-${info.project.name}-${viewport.width}-geometry`,{body:JSON.stringify(before),contentType:'application/json'})
    expect(before.documentHeight,`${row.name}: document must stay within the bounded viewport`).toBeLessThanOrEqual(viewport.height+1)
    expect(before.hostOverflow).not.toMatch(/hidden|clip/)
    expect(before.bodyOverflow).not.toMatch(/hidden|clip/)
    expect(before.panelOverflow).toBe('auto')
    expect(before.labelAnchoredToPanel).toBe(true)
    expect(before.panelBottom).toBeLessThanOrEqual(viewport.height+1)
    expect(before.panelScrollHeight).toBeGreaterThan(before.panelHeight)
    expect(before.panelHeight).toBeGreaterThan(viewport.height*0.35)
    await expect(panel.locator('.vobs-row-head strong')).toHaveText(fixture.containmentCollectiveIds.map(id=>`Collective ${id}`))
    expect(await panel.locator('.vobs-list > li').evaluateAll((rows)=>rows.every((node)=>node.getClientRects().length>0&&node.getBoundingClientRect().height>0))).toBe(true)
    await panel.evaluate((node)=>{node.scrollTop=node.scrollHeight})
    const last=fixture.containmentCollectiveIds.at(-1)
    const action=panel.getByRole('button',{name:`untrack Collective ${last}`,exact:true})
    await action.focus()
    await expect(action).toBeFocused()
    expect(await action.evaluate((node)=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
    const after=await geometry()
    expect(after.documentHeight,`${row.name}: focus and native scrolling must not grow the document`).toBeLessThanOrEqual(viewport.height+1)
    await info.attach(`${row.name}-${motion.name}-${info.project.name}-${viewport.width}-scrolled-geometry`,{body:JSON.stringify(after),contentType:'application/json'})
    await page.screenshot({path:info.outputPath(`bounded-${row.hostPosition}-${motion.value}-${info.project.name}-${viewport.width}.png`)})
  })
}

async function assertUpdatedDiagnostics(panel) {
  const expected = fixture.update.expect
  const row = panel.locator(`[data-evidence-id="${expected.diagnosticId}"]`)
  await row.scrollIntoViewIfNeeded()
  await expect(row.locator('p').first(), 'updated diagnostics: exact visible outcome').toHaveText(expected.outcome)
  await expect(row.locator('p').first()).toBeVisible()
  await expect(row.locator('time'), 'updated diagnostics: exact occurred timestamp').toHaveText(expected.occurredAt)
  await expect(row.locator('time')).toHaveAttribute('datetime', expected.occurredAt)
  await row.locator('time').scrollIntoViewIfNeeded()
  await expect(row.locator('time')).toBeVisible()
  await expect(panel.locator('.vobs-summary'), 'updated diagnostics: exact summary including total').toHaveText(expected.summary)
  await panel.locator('.vobs-summary').scrollIntoViewIfNeeded()
  await expect(panel.locator('.vobs-summary')).toBeVisible()
  await expect(panel.locator('.pgn-num'), 'updated diagnostics: exact page count and labels').toHaveText(expected.pageLabels)
  await panel.locator('.pgn').scrollIntoViewIfNeeded()
  for(const button of await panel.locator('.pgn-num').all()) await expect(button).toBeInViewport({ratio:1})
  return {outcome:await row.locator('p').first().textContent(), occurredAt:await row.locator('time').textContent(), summary:await panel.locator('.vobs-summary').textContent(), pageLabels:await panel.locator('.pgn-num').allTextContents()}
}

test('local village mounted catalog, history and independent pages', async ({ page, request }, info) => {
  const theme = info.project.name
  await page.setViewportSize({ width: 1280, height: 1100 })
  const url = `${origin}/?fb=off&app=graph&section=village&theme=${theme}#inuse`
  // Exact served artifact, not merely a DOM marker or an existing server that happens to mount.
  const html = await readFile('dist/index.html', 'utf8')
  expect(await (await request.get(url)).text()).toBe(html)
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.(?:js|css))"/g)].map((match) => match[1])
  expect(assets.length).toBeGreaterThan(0)
  for (const asset of assets) expect(digest(await (await request.get(origin + asset)).body())).toBe(digest(await readFile(`dist${asset}`)))
  await info.attach('served-build-provenance', { body: JSON.stringify({ theme, htmlSha256: digest(html), assets }), contentType: 'application/json' })
  await page.goto(url)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  const shell = page.locator('#inuse')
  const body = shell.locator('.vobs')
  await expect(shell.getByRole('button', { name: 'online', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(body.locator('strong').filter({ hasText: 'Acme Platform' })).toBeVisible()
  await body.getByRole('button', { name: 'fetch metadata' }).click()
  await expect(body.getByRole('status')).toContainText('partial fetch')
  await expect(body.locator('strong').filter({ hasText: 'Acme Platform Tools' })).toBeVisible()
  await expect(body.locator('[data-domain=history]')).toContainText('2026-10-15T09:00:00Z')
  await body.getByRole('tab', { name: 'history', exact: true }).focus()
  await page.keyboard.press('Enter')
  await body.getByRole('navigation', { name: 'remote attempts pages' }).getByRole('button', { name: 'next page' }).click()
  await expect(body.getByText('remote attempts saved item 2', { exact: true })).toBeVisible()
  await body.getByRole('tab', { name: 'confirmed receipts' }).click()
  await body.getByRole('navigation', { name: 'confirmed receipts pages' }).getByRole('button', { name: 'next page' }).click()
  await body.getByRole('tab', { name: 'operation diagnostics' }).click()
  await body.getByRole('navigation', { name: 'operation diagnostics pages' }).getByRole('button', { name: 'next page' }).click()
  await body.getByRole('button', { name: 'fetch metadata' }).click()
  await body.getByRole('tab', { name: 'remote attempts', exact: true }).click()
  await expect(body.getByRole('navigation', { name: 'remote attempts pages' }).getByRole('button', { name: 'page 2', exact: true })).toHaveAttribute('aria-current', 'page')
  await body.getByRole('tab', { name: 'confirmed receipts' }).click()
  await expect(body.getByText('confirmed receipts saved item 2', { exact: true })).toBeVisible()
  await body.getByRole('tab', { name: 'catalog', exact: true }).click()
  await body.getByRole('button', { name: 'untrack Acme Platform Tools' }).click()
  await expect(body.getByRole('status')).toContainText('tracking removed')
  await expect(shell.getByRole('navigation', { name: 'peasant sections' })).toBeInViewport()
  await expect(body.locator('.vobs-catalog p').first()).toHaveCSS('font-size', '16px')
  expect(await body.locator('.vobs-catalog p').first().evaluate((node) => getComputedStyle(node).fontFamily)).toContain('Atkinson Hyperlegible"')
  expect(await body.locator('p').first().evaluate((node) => getComputedStyle(node).fontFamily)).toContain('Atkinson')
  const axe = await new AxeBuilder({ page }).include('#inuse').analyze()
  expect(axe.violations).toEqual([])
  await body.locator('.tabpanel:visible').evaluate((node) => { node.scrollTop = 0 })
  await shell.screenshot({ path: info.outputPath(`village-${theme}-desktop.png`) })
  await page.setViewportSize({ width: 390, height: 844 })
  await body.locator('.tabpanel:visible').evaluate((node) => { node.scrollTop = 0 })
  await shell.screenshot({ path: info.outputPath(`village-${theme}-mobile.png`) })
  expect(await body.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)

  // The same named states used by SSR/DOM gates and stories, mounted on the real demo route.
  for (const row of fixture.cases) {
    await page.goto(`${origin}/?fb=off&app=graph&section=village&observations=${row.name}&theme=${theme}#inuse`)
    for (const text of row.text) await expect(body.getByText(text, { exact: false }).first()).toBeVisible()
    for (const text of row.absent ?? []) await expect(body.getByText(text, { exact: false })).toHaveCount(0)
    expect(await body.evaluate((node) => node.scrollWidth <= node.clientWidth), row.name).toBe(true)
    if (row.name === 'selected-page-conflict') {
      await body.getByRole('button', { name: 'restart this category' }).click()
      await expect(body.getByText('Historical Collective', { exact: true })).toBeVisible()
      await expect(body.getByRole('navigation', { name: 'remote attempts pages' }).getByRole('button', { name: 'page 1', exact: true })).toHaveAttribute('aria-current', 'page')
    }
    if (row.name === 'village-unavailable') await expect(shell.locator('.cx-offline-icon')).toHaveCount(0)
  }
  await page.goto(`${url.replace('#inuse', '')}&local=offline#inuse`)
  await expect(shell.locator('.vobs')).toBeVisible()
  await expect(shell.getByText('on this computer', { exact: false }).first()).toBeVisible()
  await shell.getByRole('button', { name: 'settings', exact: true }).click()
  await expect(shell.getByText('changes save right away', { exact: false })).toBeVisible()
  await shell.getByRole('button', { name: 'online', exact: true }).click()
  await expect(body).toBeVisible()
})

test('persistent tools and paragraph separation on long mounted evidence', async ({page}, info)=>{
  const theme=info.project.name
  for(const viewport of [fixture.scroll.desktop,fixture.scroll.mobile]){
    await page.setViewportSize(viewport)
    await page.goto(`${origin}/?fb=off&app=graph&section=village&observations=${fixture.scroll.name}&theme=${theme}#inuse`)
    const body=page.locator('.vobs')
    await body.waitFor()
    await page.locator('#inuse').evaluate((node)=>node.scrollIntoView({block:'start',behavior:'instant'}))
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme)
    const scroller=body.locator('.vobs-history > .tabpanel:visible')
    const gap=await scroller.locator('[data-domain=history] .vobs-issue').evaluate((node)=>{
      const [a,b]=node.querySelectorAll('p');return {gap:b.getBoundingClientRect().top-a.getBoundingClientRect().bottom,line:parseFloat(getComputedStyle(a).lineHeight)}
    })
    expect(gap.gap).toBeGreaterThanOrEqual(gap.line)
    await scroller.locator('[data-domain=history] .vobs-issue').scrollIntoViewIfNeeded()
    await page.locator('#inuse').screenshot({path:info.outputPath(`spacing-${theme}-${viewport.width}.png`)})
    await scroller.evaluate((node)=>{node.scrollTop=node.scrollHeight})
    const selectors=['nav[aria-label="peasant sections"]','.vobs-header','.vobs > .tabs','.vobs-history > .tabs']
    const rectangles=[]
    for(const selector of selectors){
      const item=page.locator(selector);await expect(item).toBeInViewport({ratio:1});
      rectangles.push(await item.evaluate((node)=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
    }
    for(let i=1;i<rectangles.length;i++) expect(rectangles[i].top).toBeGreaterThanOrEqual(rectangles[i-1].bottom)
    for(const selector of ['.vobs-header button','.vobs > .tabs button','.vobs-history > .tabs button']){
      const buttons=page.locator(selector)
      for(const button of await buttons.all()) expect(await button.evaluate((node)=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
    }
    expect((await scroller.boundingBox()).height).toBeGreaterThan(viewport.height*0.35)
    await expect(body.locator('.vobs-scope')).toContainText(fixture.base.accountLabel)
    const fetch=body.getByRole('button',{name:'fetch metadata'})
    expect(await fetch.evaluate((node)=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
    await fetch.focus();await page.keyboard.press('Tab')
    const focused=await page.evaluate(()=>{const node=document.activeElement;const r=node.getBoundingClientRect();return {visible:r.top>=0&&r.bottom<=innerHeight,hit:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),outline:getComputedStyle(node).outlineStyle}})
    expect(focused.visible&&focused.hit).toBe(true);expect(focused.outline).not.toBe('none')
    await info.attach(`persistent-tools-${theme}-${viewport.width}`,{body:JSON.stringify({theme,viewport,gap,rectangles,focused}),contentType:'application/json'})
    await page.locator('#inuse').screenshot({path:info.outputPath(`persistent-${theme}-${viewport.width}.png`)})
  }
})

test('native controlled host and unavailable action contracts',async({page},info)=>{
  test.setTimeout(180_000)
  const theme=info.project.name
  const story=async(name)=>{await page.goto(`/iframe.html?id=in-use-village-observations--host-contract&viewMode=story&globals=theme:${theme}&args=caseName:${name}`);await expect(page.locator('.vobs')).toBeVisible();await expect(page.getByLabel('host callbacks')).toHaveText('[]')}
  for(const row of fixture.controlledCases){
    await story(row.name)
    const list=page.getByRole('tablist',{name:row.panel})
    await list.getByRole('tab',{name:row.label,exact:true}).click()
    await expect(page.getByLabel('host callbacks')).toHaveText(JSON.stringify([[row.callback,row.target]]))
    await expect(list.getByRole('tab',{name:row.label,exact:true})).toHaveAttribute('aria-selected','false')
    await page.getByRole('button',{name:'apply host selection'}).click()
    await expect(list.getByRole('tab',{name:row.label,exact:true})).toHaveAttribute('aria-selected','true')
    await expect(page.getByLabel('host callbacks')).toHaveText(JSON.stringify([[row.callback,row.target]]))
  }
  for(const row of fixture.activationCases){
    await story(row.name)
    const panel=page.locator('.vobs-history > .tabpanel:visible')
    const next=panel.getByRole('button',{name:'next page',includeHidden:true})
    await panel.evaluate((node)=>{node.scrollTop=node.scrollHeight})
    const box=await next.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2)
    await expect(page.getByLabel('host callbacks')).toHaveText(JSON.stringify(row.blocked?[]:[['page','remote-attempts',2]]))
    await next.evaluate((node)=>node.focus())
    expect(await next.evaluate((node)=>node===document.activeElement)).toBe(!row.blocked)
    await panel.focus();await page.keyboard.press('Tab');await page.keyboard.press('Tab')
    const inPager=await page.evaluate(()=>!!document.activeElement.closest('.vobs-pager'))
    expect(inPager).toBe(!row.blocked)
    if(!row.blocked){await next.focus();await page.keyboard.press('Enter');await expect(page.getByLabel('host callbacks')).toHaveText(JSON.stringify([['page','remote-attempts',2],['page','remote-attempts',2]]))}
  }
  for(const row of fixture.fetchCases){
    await story(row.name)
    const button=page.getByRole('button',{name:'fetch metadata'})
    if(row.blocked) await expect(button).toBeDisabled()
    else await expect(button).toBeEnabled()
    const box=await button.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2)
    await expect(page.getByLabel('host callbacks')).toHaveText(JSON.stringify(row.blocked?[]:[['fetch']]))
    await button.evaluate((node)=>node.focus());expect(await button.evaluate((node)=>node===document.activeElement)).toBe(!row.blocked)
  }
  await story(fixture.update.name)
  await page.getByRole('button',{name:'apply evidence update'}).click()
  const panel=page.locator('.vobs-history > .tabpanel:visible')
  await expect(page.getByRole('tab',{name:'confirmed receipts'})).toHaveAttribute('aria-selected','true')
  await expect(panel.locator('[data-evidence-id=receipt-1]')).toBeAttached()
  await expect(panel.getByRole('button',{name:'page 3',exact:true})).toHaveAttribute('aria-current','page')
  await expect(panel.locator('[data-domain=catalog]')).toContainText('2026-10-17T12:00:00Z')
  await expect(panel.locator('[data-domain=history]')).toContainText('2026-10-15T09:00:00Z')
  await expect(page.getByLabel('host callbacks')).toHaveText('[]')
  await page.getByRole('tab',{name:'remote attempts',exact:true}).click();await page.getByRole('button',{name:'apply host selection'}).click()
  await expect(page.locator('.vobs-history > .tabpanel:visible [data-evidence-id=attempt-1]')).toBeAttached()
  await expect(page.locator('.vobs-history > .tabpanel:visible').getByRole('button',{name:'page 2',exact:true})).toHaveAttribute('aria-current','page')
  await page.getByRole('tab',{name:'operation diagnostics'}).click();await page.getByRole('button',{name:'apply host selection'}).click()
  await assertUpdatedDiagnostics(page.locator('.vobs-history > .tabpanel:visible'))
})

test('production fetch renders exact changed diagnostic values',async({page,request},info)=>{
  const theme=info.project.name
  const html=await readFile('dist/index.html','utf8')
  expect(await(await request.get(origin)).text()).toBe(html)
  for(const asset of [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.(?:js|css))"/g)].map((match)=>match[1])) expect(digest(await(await request.get(origin+asset)).body())).toBe(digest(await readFile(`dist${asset}`)))
  for(const viewport of [fixture.scroll.desktop,fixture.scroll.mobile]){
    await page.setViewportSize(viewport)
    // Each size starts with the initial saved projection, not the prior size's post-fetch UI.
    await page.goto('about:blank')
    await page.goto(`${origin}/?fb=off&app=graph&section=village&theme=${theme}#inuse`)
    const body=page.locator('.vobs')
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme)
    await body.getByRole('tab',{name:'history',exact:true}).click()
    await body.getByRole('navigation',{name:'remote attempts pages'}).getByRole('button',{name:'next page'}).click()
    await body.getByRole('tab',{name:'confirmed receipts'}).click()
    await body.getByRole('navigation',{name:'confirmed receipts pages'}).getByRole('button',{name:'next page'}).click()
    await body.getByRole('tab',{name:'operation diagnostics'}).click()
    const panel=body.locator('.vobs-history > .tabpanel:visible')
    const before=fixture.base.categories.find((category)=>category.id==='operation-diagnostics')
    await expect(panel.locator('.vobs-summary')).toHaveText(`${before.total} saved items; coverage: ${before.coverage}`)
    await expect(panel.locator(`[data-evidence-id="${before.rows[0].id}"] > p`).first()).toHaveText(before.rows[0].outcome)
    await body.getByRole('button',{name:'fetch metadata'}).click()
    await expect(body.getByRole('tab',{name:'operation diagnostics'})).toHaveAttribute('aria-selected','true')
    const observed=await assertUpdatedDiagnostics(panel)
    await expect(panel.locator('[data-domain=catalog]')).toContainText('2026-10-17T12:00:00Z')
    await expect(panel.locator('[data-domain=history]')).toContainText('2026-10-15T09:00:00Z')
    await info.attach(`production-fetch-diagnostic-values-${theme}-${viewport.width}`,{body:JSON.stringify({theme,viewport,before,expected:fixture.update.expect,observed}),contentType:'application/json'})
    for(const category of [fixture.base.categories[0],fixture.base.categories[1]]){
      await body.getByRole('tab',{name:category.label,exact:true}).click()
      const retained=body.locator('.vobs-history > .tabpanel:visible')
      await expect(retained.getByRole('button',{name:'page 2',exact:true})).toHaveAttribute('aria-current','page')
      await expect(retained.locator(`[data-evidence-id="${category.id}-2"]`)).toBeAttached()
    }
  }
})
