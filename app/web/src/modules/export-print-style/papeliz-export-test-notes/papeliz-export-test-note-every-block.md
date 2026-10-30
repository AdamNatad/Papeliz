---
tags: [export, test]
status: draft
created: 2026-10-30
lang: en
---
# Every block

A paragraph with **bold**, *italic*, ***bold italic***, ~~strikethrough~~, <u>underlined</u> and `inline code` text.
This line follows a soft break, so it joins the line above.  
This line follows a hard break, so it starts a line of its own.

Styled text: <span style="color: purple">purple</span>, <span style="color: #0e6b61">teal by hex</span>, <span style="font-size: 1.5em">larger</span> and <span style="color: red; font-size: 0.85em">small red</span>.

Links: [the Papeliz site](https://papeliz.com), <mailto:hello@example.com>, https://example.com/a-bare-link and a [link to a heading](#lists).

Wikilinks: [[Links and headings]], [[Links and headings|a labelled link]], [[Links and headings#Part two]], [[#Quotes]] and [[A note that doesn't exist yet]].

Tags: #reading and #export/word.

## Lists

- A bullet
- A bullet with **bold**
  - A nested bullet
    - A bullet three deep
- Back at the top

3. Counting from three
4. Four
   1. A nested number
   2. Another
5. Five

A paragraph between two numbered lists.

1. A list that starts again
2. at one

A paragraph before the task list.

- [ ] A task to do
- [x] A task that is done
  - [ ] A nested task
- [ ] Another task

A paragraph before a loose list.

- A loose list item

  With a second paragraph.

- And another loose item

## Quotes

> A quote with **bold** text.
>
> > A quote inside the quote.

> [!tip] A callout
> A card with its icon and title, and a list:
> - one
> - two

> [!warning|#7c3aed] A callout in a custom color
> With `code` and a [[#Lists|link to Lists]].

## Code

```ts
function greet(personName: string): string {
	return `Hello, ${personName}`
}
```

### Heading three

#### Heading four

##### Heading five

###### Heading six

| Column | Another |
| --- | ---: |
| A cell | 1 |
| [[Links and headings]] | 2 |

---

A footnote reference.[^first] Another one.[^second]

A picture: ![A blue square](https://papeliz.com/missing-square.png)

[^first]: The footnote's text.
[^second]: A footnote with **bold** and a [link](https://example.com/footnote).
