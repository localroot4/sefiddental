// Structured data of every public template (phase 6 step 3, H15, C31): the rendered JSON-LD is one
// schema.org @graph per script with no marker, resolvable @id references, absolute URLs and ISO
// dates; each template carries its types; FAQPage repeats the visible FAQ; the article graph
// holds what Google's Article guidance asks for. The builders' vocabulary is checked offline by
// the schema-dts `satisfies` in src/lib/seo/jsonld.ts; this spec checks what pages render.
// Writes test-results/structured-data.json for the phase report.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

import {
  ARTICLES_HUB,
  articleTemplates,
  CASES,
  FIXED_TEMPLATES,
  graphProblems,
  jsonLd,
  jsonLdScripts,
  ofType,
  type JsonLdNode,
  type SeoTemplate,
} from '../helpers/jsonld';
import { routeExists } from '../helpers/pending';

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

/** Every template whose route exists in this build; the article ones are found on the hub. */
async function templates(request: APIRequestContext): Promise<SeoTemplate[]> {
  const list = [...FIXED_TEMPLATES];
  if (routeExists('cases')) list.push(CASES);
  if ((['articlesHub', 'article', 'articleCategory', 'tag'] as const).every(routeExists)) {
    list.push(ARTICLES_HUB, ...(await articleTemplates(request)));
  }
  return list;
}

async function answers200(request: APIRequestContext, url: string, type?: RegExp) {
  const response = await request.get(url);
  expect(response.status(), url).toBe(200);
  if (type) expect(response.headers()['content-type'], url).toMatch(type);
}

/** FAQPage only where FAQs render, with the visible questions in order (FaqList: details.border-t). */
async function expectFaqMatches(page: Page, nodes: JsonLdNode[], where: string) {
  const visible = await page
    .locator('main details.border-t > summary')
    .evaluateAll((els) => els.map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()));
  const faqs = ofType(nodes, 'FAQPage');
  expect(faqs.length, `${where}: one FAQPage at most`).toBeLessThanOrEqual(1);
  const questions = ((faqs[0]?.mainEntity ?? []) as Array<{ name: string }>).map((q) =>
    q.name.replace(/\s+/g, ' ').trim(),
  );
  expect(questions, `${where}: FAQPage = visible FAQ`).toEqual(visible);
}

/** Article page (Google's Article guidance, H15, C1). */
async function expectArticle(request: APIRequestContext, nodes: JsonLdNode[], where: string) {
  const [article] = ofType(nodes, 'Article');
  const page = nodes.find((n) => n['@type'] === 'MedicalWebPage' || n['@type'] === 'WebPage');
  expect(article, where).toBeDefined();
  expect(page, `${where}: the article's MedicalWebPage or WebPage`).toBeDefined();
  expect(article!.headline, where).toEqual(expect.any(String));
  expect(String(article!.headline).length, `${where}: headline length`).toBeLessThanOrEqual(110);
  await answers200(request, String(article!.image), /^image\//);
  const published = Date.parse(String(article!.datePublished));
  const modified = Date.parse(String(article!.dateModified));
  expect(published, `${where}: datePublished <= dateModified`).toBeLessThanOrEqual(modified);
  const author = article!.author as { '@type': string; name?: string; url?: string };
  expect(author['@type']).toBe('Person');
  expect(author.name, `${where}: author name`).toEqual(expect.any(String));
  if (author.url) await answers200(request, author.url);
  expect(article!.publisher).toEqual({ '@id': expect.stringMatching(/\/#dentist$/) });
  expect(article!.mainEntityOfPage).toEqual({ '@id': page!['@id'] });
  expect(page!.mainEntity).toEqual({ '@id': article!['@id'] });
  expect(page!.isPartOf).toEqual({ '@id': expect.stringMatching(/\/#website$/) });
  expect(page!.reviewedBy, `${where}: reviewedBy`).toMatchObject({ '@type': 'Person' });
  expect(page!.lastReviewed, `${where}: lastReviewed`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(article, `${where}: reviewedBy sits on the page, not the Article`).not.toHaveProperty(
    'reviewedBy',
  );
}

test('T-SD1 every template renders valid, complete JSON-LD for its type', async ({
  page,
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  test.setTimeout(180_000);
  const report: Array<{ template: string; path: string; types: string[]; problems: string[] }> = [];
  for (const template of await templates(request)) {
    const where = template.path;
    const response = await page.goto(encodeURI(where));
    expect(response?.status(), where).toBe(200);
    const scripts = jsonLdScripts(await page.content());
    const nodes = await jsonLd(page);
    const problems = graphProblems(scripts);
    report.push({
      template: template.name,
      path: where,
      types: nodes.map((n) => n['@type']),
      problems,
    });
    expect(problems, where).toEqual([]);

    const types = nodes.map((n) => n['@type']);
    for (const type of ['Dentist', 'WebSite', ...template.types]) {
      expect(types, `${where}: ${type}`).toContain(type);
    }
    await expectFaqMatches(page, nodes, where);

    for (const list of ofType(nodes, 'BreadcrumbList')) {
      const items = list.itemListElement as Array<{ item: string }>;
      for (const item of items) await answers200(request, item.item);
    }
    if (template.name === 'guide') expect(ofType(nodes, 'Article'), where).toHaveLength(0);
    if (template.name === 'article') await expectArticle(request, nodes, where);
    if (template.name === 'service' || template.name === 'restoration') {
      expect(ofType(nodes, 'Service')[0]?.provider).toEqual({
        '@id': expect.stringMatching(/\/#dentist$/),
      });
    }
  }
  const out = path.join(process.cwd(), 'test-results', 'structured-data.json');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
});
