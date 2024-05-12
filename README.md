# Spite

Spite is a simple templating language which is purely HTML-based, intended to complement
[Anguish](https://github.com/anguishjs/anguish).

It doesn’t aim to be a full framework like Astro, but rather makes it easy to integrate in any build system by exposing a simple API.

``` js
import { render } from "@anguish/spite";

const components = {
  button: `
    <button class="btn" x-bind>
      <slot></slot>
    </button>
  `,
};

render(`<x-button class="pink">Click me!</x-button>`, { components });
// <button class="btn pink">Click me!</button>
```
