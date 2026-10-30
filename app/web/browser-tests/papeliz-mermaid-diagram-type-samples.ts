// One sample per diagram type Mermaid 12 offers, each using the features that type has (titles,
// notes, styling, links), for papeliz-mermaid-diagrams.browser-test.ts. `mermaidDiagramTypeName` is
// the name Mermaid gives the drawing (its `aria-roledescription`).

export interface PapelizMermaidDiagramTypeSample {
  mermaidDiagramSampleLabel: string
  mermaidDiagramTypeName: string
  mermaidDiagramSource: string
}

export const papelizMermaidDiagramTypeSamples: readonly PapelizMermaidDiagramTypeSample[] = [
  {
    mermaidDiagramSampleLabel: 'flowchart',
    mermaidDiagramTypeName: 'flowchart-v2',
    mermaidDiagramSource: `---
title: Order pipeline
---
flowchart LR
  start([Start]) --> cart[Cart]
  cart -->|checkout| pay{Paid?}
  pay -- yes --> ship[/Ship order/]
  pay -. no .-> retry[(Retry queue)]
  subgraph warehouse [Warehouse]
    pick[[Pick items]] --> pack>Pack box]
  end
  ship --> pick
  doc@{ shape: doc, label: "Packing slip" } --> pack
  md["\`**Bold** and _italic_\`"] --> start
  classDef decision fill:#fde68a,stroke:#b45309,color:#111
  class pay decision
  click cart "https://example.com" "Open the cart"`,
  },
  {
    mermaidDiagramSampleLabel: 'flowchart, ELK layout',
    mermaidDiagramTypeName: 'flowchart-v2',
    mermaidDiagramSource: `---
config:
  layout: elk
---
flowchart TD
  A[Request] --> B{Cached?}
  B -->|yes| C[Serve cache]
  B -->|no| D[Fetch origin] --> C`,
  },
  {
    mermaidDiagramSampleLabel: 'sequence',
    mermaidDiagramTypeName: 'sequence',
    mermaidDiagramSource: `sequenceDiagram
  title Sign-in flow
  autonumber
  box Browser
    actor User
    participant App
  end
  participant API as Auth API
  User->>+App: Open sign-in
  App->>+API: POST /session
  Note over App,API: Over TLS
  alt valid password
    API-->>App: 200 token
  else wrong password
    API-->>App: 401
  end
  loop every minute
    App->>API: Refresh
  end
  App-->>-User: Signed in
  deactivate API`,
  },
  {
    mermaidDiagramSampleLabel: 'class',
    mermaidDiagramTypeName: 'classDiagram',
    mermaidDiagramSource: `classDiagram
  class Vault {
    <<interface>>
    +String vaultName
    +listNotes() List~Note~
  }
  class Note {
    +String vaultNoteRelativePath
    +save() bool
  }
  Vault "1" *-- "many" Note : holds
  note for Vault "A folder on disk"`,
  },
  {
    mermaidDiagramSampleLabel: 'state',
    mermaidDiagramTypeName: 'stateDiagram',
    mermaidDiagramSource: `stateDiagram-v2
  [*] --> Idle
  Idle --> Saving : edit
  state Saving {
    [*] --> Writing
    Writing --> [*]
  }
  state check <<choice>>
  Saving --> check
  check --> Idle : ok
  check --> Conflict : changed on disk
  note right of Conflict : The person picks a version
  Conflict --> [*]`,
  },
  {
    mermaidDiagramSampleLabel: 'entity relationship',
    mermaidDiagramTypeName: 'er',
    mermaidDiagramSource: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains
  CUSTOMER {
    string customerName PK
    string email UK "login"
  }
  ORDER {
    int orderNumber PK
  }`,
  },
  {
    mermaidDiagramSampleLabel: 'user journey',
    mermaidDiagramTypeName: 'journey',
    mermaidDiagramSource: `journey
  title Writing a note
  section Open
    Open Papeliz: 5: Writer
  section Write
    Ask the assistant: 4: Writer, Assistant`,
  },
  {
    mermaidDiagramSampleLabel: 'gantt',
    mermaidDiagramTypeName: 'gantt',
    mermaidDiagramSource: `gantt
  title Release plan
  dateFormat YYYY-MM-DD
  excludes weekends
  section Design
    Mockups :done, des1, 2026-01-05, 5d
    Review  :active, des2, after des1, 3d
  section Build
    Editor  :crit, b1, after des2, 6d
    Release :milestone, m1, after b1, 0d`,
  },
  {
    mermaidDiagramSampleLabel: 'pie',
    mermaidDiagramTypeName: 'pie',
    mermaidDiagramSource: `pie showData
  title Notes by folder
  "Guides" : 42
  "Journal" : 28
  "Projects" : 18
  "Inbox" : 12`,
  },
  {
    mermaidDiagramSampleLabel: 'quadrant chart',
    mermaidDiagramTypeName: 'quadrantChart',
    mermaidDiagramSource: `quadrantChart
  title Features by reach and effort
  x-axis Low effort --> High effort
  y-axis Low reach --> High reach
  quadrant-1 Plan carefully
  quadrant-2 Do first
  quadrant-3 Skip
  quadrant-4 Maybe later
  Tables: [0.3, 0.8]
  Sync: [0.85, 0.6]`,
  },
  {
    mermaidDiagramSampleLabel: 'requirement',
    mermaidDiagramTypeName: 'requirement',
    mermaidDiagramSource: `requirementDiagram
  requirement keep_key_local {
    id: 1
    text: The API key stays in the browser.
    risk: high
    verifymethod: test
  }
  element assistant_panel {
    type: component
  }
  assistant_panel - satisfies -> keep_key_local`,
  },
  {
    mermaidDiagramSampleLabel: 'git graph',
    mermaidDiagramTypeName: 'gitGraph',
    mermaidDiagramSource: `gitGraph
  commit id: "init"
  branch develop
  checkout develop
  commit id: "diagrams" type: HIGHLIGHT
  checkout main
  merge develop tag: "v0.2"`,
  },
  {
    mermaidDiagramSampleLabel: 'C4',
    mermaidDiagramTypeName: 'c4',
    mermaidDiagramSource: `C4Context
  title System context
  Person(writer, "Writer", "Writes notes")
  System(papeliz, "Papeliz", "Markdown editor")
  System_Ext(provider, "AI provider", "The provider picked")
  Enterprise_Boundary(device, "Device") {
    SystemDb(vault, "Vault", "Notes")
  }
  Rel(writer, papeliz, "Uses")
  Rel(papeliz, vault, "Reads and writes")
  Rel(papeliz, provider, "Sends prompts", "HTTPS")`,
  },
  {
    mermaidDiagramSampleLabel: 'mindmap',
    mermaidDiagramTypeName: 'mindmap',
    mermaidDiagramSource: `mindmap
  root((Papeliz))
    Editor
      MD View
    Assistant
      (Inline edits)
    Export
      {{Word}}`,
  },
  {
    mermaidDiagramSampleLabel: 'timeline',
    mermaidDiagramTypeName: 'timeline',
    mermaidDiagramSource: `timeline
  title Milestones
  section Planning
    0.1 : Design
  section Launch
    0.2 : Editor
        : Export`,
  },
  {
    mermaidDiagramSampleLabel: 'sankey',
    mermaidDiagramTypeName: 'sankey',
    mermaidDiagramSource: `sankey-beta
Visits,Editor,60
Visits,Help,25
Editor,New vault,35`,
  },
  {
    mermaidDiagramSampleLabel: 'XY chart',
    mermaidDiagramTypeName: 'xychart',
    mermaidDiagramSource: `xychart-beta
  title "Notes per month"
  x-axis [jan, feb, mar, apr]
  y-axis "Notes" 0 --> 100
  bar [30, 45, 60, 80]
  line [25, 40, 58, 70]`,
  },
  {
    mermaidDiagramSampleLabel: 'block',
    mermaidDiagramTypeName: 'block',
    mermaidDiagramSource: `block-beta
  columns 3
  browser["Browser"]:3
  app["Papeliz app"] arrow<["reads"]>(right) vault[("Vault")]`,
  },
  {
    mermaidDiagramSampleLabel: 'packet',
    mermaidDiagramTypeName: 'packet',
    mermaidDiagramSource: `packet
title UDP Packet
+16: "Source Port"
+16: "Destination Port"
32-47: "Length"
48-63: "Checksum"`,
  },
  {
    mermaidDiagramSampleLabel: 'kanban',
    mermaidDiagramTypeName: 'kanban',
    mermaidDiagramSource: `kanban
  todo[To do]
    t1[Check every diagram type]@{ ticket: PZ-12, priority: 'High' }
  done[Done]
    t2[Tables in MD View]`,
  },
  {
    mermaidDiagramSampleLabel: 'architecture',
    mermaidDiagramTypeName: 'architecture',
    mermaidDiagramSource: `architecture-beta
  group device(cloud)[Device]
  service app(server)[Papeliz] in device
  service vault(disk)[Vault] in device
  service provider(internet)[AI provider]
  app:L -- R:vault
  app:R --> L:provider`,
  },
  {
    mermaidDiagramSampleLabel: 'radar',
    mermaidDiagramTypeName: 'radar',
    mermaidDiagramSource: `radar-beta
  title Editors compared
  axis speed["Speed"], ai["Assistant"], export["Export"]
  curve a["Papeliz"]{4, 5, 4}
  curve b["Plain editor"]{5, 1, 2}
  max 5
  min 0`,
  },
  {
    mermaidDiagramSampleLabel: 'treemap',
    mermaidDiagramTypeName: 'treemap',
    mermaidDiagramSource: `treemap-beta
"Vault"
    "Guides"
        "Writing": 12
        "Export": 8
    "Journal": 30`,
  },
  {
    mermaidDiagramSampleLabel: 'Venn',
    mermaidDiagramTypeName: 'venn',
    mermaidDiagramSource: `venn-beta
  title What makes a good feature
  set Desirable
  set Feasible
  set Viable
  union Desirable,Feasible["Buildable"]
  union Desirable,Feasible,Viable["Ship it"]`,
  },
  {
    mermaidDiagramSampleLabel: 'Ishikawa',
    mermaidDiagramTypeName: 'ishikawa',
    mermaidDiagramSource: `ishikawa-beta
    Blurry Photo
    Process
        Out of focus
    Equipment
        Dirty lens`,
  },
  {
    mermaidDiagramSampleLabel: 'Wardley',
    mermaidDiagramTypeName: 'wardley',
    mermaidDiagramSource: `wardley-beta
title Tea Shop
anchor Business [0.95, 0.63]
component Cup of Tea [0.79, 0.61]
component Kettle [0.43, 0.35]
Business -> Cup of Tea
Cup of Tea -> Kettle
evolve Kettle 0.62
note "Kettles evolve" [0.30, 0.49]`,
  },
  {
    mermaidDiagramSampleLabel: 'Cynefin',
    mermaidDiagramTypeName: 'cynefin',
    mermaidDiagramSource: `cynefin-beta
  title Strategy
  complex
    "Market research"
  complicated
    "Competitive analysis"
  clear
    "Standard pricing"
  chaotic
    "Crisis management"
  complex --> complicated : "Pattern identified"`,
  },
  {
    mermaidDiagramSampleLabel: 'railroad, EBNF',
    mermaidDiagramTypeName: 'railroadEbnf',
    mermaidDiagramSource: `railroad-ebnf-beta
title "Optional Sign"
sign = "+" | "-" ;
number = sign? digit+ ;
digit = "0" | "1" | "2" ;`,
  },
  {
    mermaidDiagramSampleLabel: 'railroad, ABNF',
    mermaidDiagramTypeName: 'railroadAbnf',
    mermaidDiagramSource: `railroad-abnf-beta
title "Email Address"
address = local-part "@" domain ;
local-part = 1*( ALPHA / DIGIT / "." ) ;
domain = 1*( ALPHA / "-" ) ;`,
  },
  {
    mermaidDiagramSampleLabel: 'railroad, PEG',
    mermaidDiagramTypeName: 'railroadPeg',
    mermaidDiagramSource: `railroad-peg-beta
title "Calculator"
Expression <- Term (("+" / "-") Term)* ;
Term <- Digit+ ;
Digit <- "0" / "1" / "2" ;`,
  },
  {
    mermaidDiagramSampleLabel: 'railroad, primitives',
    mermaidDiagramTypeName: 'railroad',
    mermaidDiagramSource: `railroad-beta
title Expression
expression = sequence(
    nonterminal("term"),
    zeroOrMore(sequence(choice(terminal("+"), terminal("-")), nonterminal("term")))
) ;`,
  },
  {
    mermaidDiagramSampleLabel: 'swimlanes',
    mermaidDiagramTypeName: 'swimlane',
    mermaidDiagramSource: `swimlane-beta LR
  subgraph Customer
    request[Request service]
  end
  subgraph Support
    triage[Triage request]
  end
  request --> triage
  triage -->|Known issue| request`,
  },
  {
    mermaidDiagramSampleLabel: 'use case',
    mermaidDiagramTypeName: 'usecase',
    mermaidDiagramSource: `usecase-beta
direction LR
actor Customer
systemBoundary Storefront
  Browse("Browse catalogue")
  Checkout("Checkout")
end
Customer --> Browse
Customer --> Checkout
Checkout ..> : include Browse`,
  },
  {
    mermaidDiagramSampleLabel: 'tree view',
    mermaidDiagramTypeName: 'treeView',
    mermaidDiagramSource: `treeView-beta
├── src/
│   ├── main.tsx ## entry point
│   └── styles.css :::highlight
└── README.md`,
  },
  {
    mermaidDiagramSampleLabel: 'event modeling',
    mermaidDiagramTypeName: 'eventmodeling',
    mermaidDiagramSource: `eventmodeling

tf 01 ui CartUI
tf 02 cmd AddItem [[AddItem01]]
tf 03 evt ItemAdded
rf 04 evt External.InventoryChanged
tf 05 pcr InventoryProcessor

data AddItem01 {
  description: 'john'
  price: 20.4
}`,
  },
  {
    mermaidDiagramSampleLabel: 'info',
    mermaidDiagramTypeName: 'info',
    mermaidDiagramSource: 'info',
  },
  {
    mermaidDiagramSampleLabel: 'agent flow',
    mermaidDiagramTypeName: 'agentflow',
    mermaidDiagramSource: `agentflow-beta TB
  brief["Release brief"]@{ shape: input }
  flow writer["Drafting Agent"]
    draft["Draft the notes"]@{ shape: task }
    lookup["changelog_search"]@{ shape: tool }
    draft --> lookup
  end
  ok["Accurate?"]@{ shape: decision }
  brief --> writer
  writer --> ok`,
  },
  {
    mermaidDiagramSampleLabel: 'a diagram in its own forest theme',
    mermaidDiagramTypeName: 'flowchart-v2',
    mermaidDiagramSource: `---
config:
  theme: forest
---
flowchart LR
  A[Forest theme] --> B[Its own colors]`,
  },
  {
    mermaidDiagramSampleLabel: 'a diagram in its own dark theme',
    mermaidDiagramTypeName: 'flowchart-v2',
    mermaidDiagramSource: `%%{init: {"theme": "dark"}}%%
flowchart LR
  A[Init line] --> B[Dark theme]`,
  },
]
