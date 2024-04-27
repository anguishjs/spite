import { parseHTML } from "linkedom";

export const render = (html: string, components: Record<string, string>) => {
  const { document } = parseHTML(html);

  const walkComponent = (el: Element, attrs: NamedNodeMap, props: Set<string>) => {
    let fallthrough = false;
    for (let { name, value } of el.attributes) {
      if (!/^:|x-bind(:|$)/.test(name)) continue;

      const prop = name[0] === ":" ? name.slice(1) : name.slice(6);
      if (!prop) {
        fallthrough = true;
      } else {
        el.removeAttribute(name);
        const res = attrs.getNamedItem(value || prop)?.value;
        if (res) el.setAttribute(prop, res);
        props.add(prop);
      }
    }

    for (const e of el.children) walkComponent(e, attrs, props);
  };

  const walk = (el: Element) => {
    const name = el.localName;

    if (name.startsWith("x-")) {
      const template = document.createElement("template");
      template.innerHTML = components[name.slice(2)];
      const props = new Set<string>();
      for (const e of template.children) walkComponent(e, el.attributes, props);

      for (const e of template.querySelectorAll("[x-bind=]")) {
        e.removeAttribute("x-bind");
        for (const attr of el.attributes) {
          if (props.has(attr.name)) continue;
          if (attr.name === "class") {
            e.classList.add(...el.classList);
          } else if (attr.name === "style") {
            let style = e.getAttribute("style");
            e.setAttribute("style", style ? style + "; " + attr.value : attr.value);
          } else {
            e.setAttributeNode(attr.cloneNode() as Attr);
          }
        }
      }

      const slot = template.querySelector("slot");
      if (slot) {
        slot.outerHTML = el.innerHTML || slot.innerHTML;
      } else if (el.innerHTML) {
        console.warn(`${name} has no <slot />`);
      }

      el.replaceWith(template.content);
    }

    for (const e of el.children) walk(e);
  };

  walk(document.documentElement);

  return document.toString() as string;
};
