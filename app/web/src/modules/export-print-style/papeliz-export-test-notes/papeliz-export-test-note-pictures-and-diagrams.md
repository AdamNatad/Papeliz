# Pictures and diagrams

A picture kept in the vault, by its path:

![A plan of the garden](pictures/garden-plan.png)

A wide photo, made smaller to fit the page:

![A wide photo of the beds](pictures/wide-photo.jpg)

A tall picture, made smaller to fit one page:

![A tall picture](pictures/tall-picture.png)

The same plan embedded by name, then given a width:

![[garden-plan.png]]

![[garden-plan.png|120]]

A drawing kept as SVG: ![A small drawing](pictures/small-drawing.svg) in a line of text.

- A list item with a picture: ![A small icon](pictures/small-icon.png)

A picture from the web, and one whose site doesn't let other pages read it:

![A picture on the web](https://pictures.example/shared.png)

![A blue square](https://papeliz.com/missing-square.png)

A picture the vault has but can't be read, and one the vault doesn't have:

![A broken picture](pictures/broken.png)

![Not in the vault](pictures/missing.png)

| Picture | What it shows |
| --- | --- |
| ![A small icon](pictures/small-icon.png) | The icon, in a table |

A flowchart:

```mermaid
flowchart LR
  A[Write a block] --> B{Cursor inside it?}
  B -- Yes --> C[Edit its Markdown]
  B -- No --> D[See it drawn]
```

A sequence diagram:

```mermaid
sequenceDiagram
  Writer->>Papeliz: Export as Word
  Papeliz-->>Writer: A file that holds its pictures
```

A diagram with a mistake, shown as its source:

```mermaid
flowchart LR
  A -->
```
