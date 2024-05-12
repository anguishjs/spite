import { parseHTML } from "linkedom";
import { minify, MinifyOptions } from "uglify-js";

const walk = (el: Element, f: (el: Element) => void) => {
  if (el.hasAttribute("x-data")) return;
  f(el);
  for (const e of el.children) walk(e, f);
};

const defaultComponents: Record<string, Component> = {
  fragment: "<slot></slot>",
  for(el, document) {
    const [bind, data] = el.getAttribute("each")!.split(" in ");
    let output = "";

    for (const i of eval.call(globalThis, data)) {
      const props = {};
      Function("$data", "$i", `with ($data) ${bind} = $i`)(
        new Proxy(props, { has: (_, p) => p !== "$i" }),
        i,
      );

      const child = document.createElement("template");
      child.innerHTML = el.innerHTML;

      walk(child, el => {
        for (let { name, value } of el.attributes) {
          if (name === "x-text") {
            el.removeAttribute(name);
            el.textContent = props[value];
          } else if (/^:|x-bind:/.test(name)) {
            const prop = name[0] === ":" ? name.slice(1) : name.slice(6);
            el.removeAttribute(name);
            const res = props[value || prop];
            if (res) el.setAttribute(prop, res);
          }
        }
      });

      output += child.innerHTML;
    }

    return output;
  },
};

export type Component = string | ((self: Element, document: Document) => string);

export interface RenderOptions {
  components: Record<string, Component>;
  layout?: string;
  minifyDirectives?: false | MinifyOptions;
}

export const render = (html: string, { components, layout, minifyDirectives: minifyOptions = {} }: RenderOptions) => {
  components = { ...defaultComponents, ...components };
  minifyOptions = minifyOptions && {
    ...minifyOptions,
    output: { quote_style: 1, ...minifyOptions.output },
  };

  const { document } = parseHTML(layout ?? html);
  if (layout != null) {
    const slot = document.querySelector("slot:not([name])");
    if (!slot) throw new Error("layout has no <slot />");
    slot.outerHTML = html;
    for (const slot of document.querySelectorAll("slot")) {
      const element = document.querySelector(`[slot=${slot.getAttribute("name")}]`);
      if (element) {
        element.remove();
        slot.outerHTML = element.outerHTML;
      } else {
        slot.outerHTML = slot.innerHTML;
      }
    }
  }

  walk(document.documentElement, (el: Element) => {
    const name = el.localName;

    if (name.startsWith("x-")) {
      const template = document.createElement("template");
      const component = components[name.slice(2)];
      if (typeof component == "string") {
        template.innerHTML = component;
      } else {
        template.innerHTML = component(el, document);
      }
      const props = new Set<string>();
      for (const e of template.children) {
        const attrs = el.attributes;
        walk(e, el => {
          for (let { name, value } of el.attributes) {
            if (!/^:|x-bind:/.test(name)) continue;

            const prop = name[0] === ":" ? name.slice(1) : name.slice(6);
            el.removeAttribute(name);
            const res = attrs.getNamedItem(value || prop)?.value;
            if (res) el.setAttribute(prop, res);
            props.add(prop);
          }
        });
      }

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
      }

      el.replaceWith(template.content);
    }

    if (minifyOptions) {
      for (const attr of el.attributes) {
        if (!/^x-|[@:.]/.test(attr.name)) continue;

        const expression = !/^x-on:|@/.test(attr.name);
        attr.value = minify(attr.value, { ...minifyOptions, expression }).code;
      }
    }
  });

  return document.toString() as string;
};
