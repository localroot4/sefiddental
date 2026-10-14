// Strict XML parsing for the feed specs (sitemaps, RSS): any well-formedness error throws.
import sax from 'sax';

export interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  text: string;
  children: XmlElement[];
}

/** Parses `xml` with sax in strict mode and returns the root element. */
export function parseXml(xml: string): XmlElement {
  const parser = sax.parser(true);
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  let error: Error | null = null;
  parser.onerror = (e) => {
    error = e;
    parser.resume();
  };
  parser.onopentag = (node) => {
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(node.attributes)) {
      attributes[key] = typeof value === 'string' ? value : value.value;
    }
    const element: XmlElement = { name: node.name, attributes, text: '', children: [] };
    const parent = stack.at(-1);
    if (parent) parent.children.push(element);
    else root = element;
    stack.push(element);
  };
  parser.onclosetag = () => void stack.pop();
  const appendText = (text: string) => {
    const current = stack.at(-1);
    if (current) current.text += text;
  };
  parser.ontext = appendText;
  parser.oncdata = appendText;
  parser.write(xml).close();
  if (error) throw error;
  if (!root) throw new Error('XML document has no root element.');
  return root;
}

/** Every descendant element named `name`, in document order. */
export function findAll(element: XmlElement, name: string): XmlElement[] {
  return element.children.flatMap((child) => [
    ...(child.name === name ? [child] : []),
    ...findAll(child, name),
  ]);
}

/** Trimmed text of the first descendant named `name`, or null. */
export function textOf(element: XmlElement, name: string): string | null {
  return findAll(element, name)[0]?.text.trim() ?? null;
}
