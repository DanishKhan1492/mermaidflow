export interface DiagramTemplate {
  name: string;
  icon: string;
  code: string;
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    name: 'Sequence',
    icon: '↔',
    code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    participant C as Charlie

    A->>B: Hello Bob, how are you?
    B-->>A: Great, thanks for asking!
    A->>C: Hey Charlie, join us?
    C-->>A: On my way!
    B->>C: Welcome to the chat!
    C-->>B: Happy to be here 🎉`,
  },
  {
    name: 'Flowchart',
    icon: '⬡',
    code: `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Check Logs]
    E --> F{Found Issue?}
    F -->|Yes| G[Fix It]
    F -->|No| H[Ask for Help]
    G --> B
    H --> B
    C --> I[Deploy 🚀]`,
  },
  {
    name: 'Class',
    icon: '◇',
    code: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +bool isIndoor
        +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat
    class Owner {
        +String name
        +adopt(animal) void
    }
    Owner --> Animal : has`,
  },
  {
    name: 'State',
    icon: '◎',
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetch
    Loading --> Success : resolve
    Loading --> Error : reject
    Success --> Idle : reset
    Error --> Loading : retry
    Error --> Idle : dismiss`,
  },
  {
    name: 'ER Diagram',
    icon: '⊞',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "is in"
    CUSTOMER {
        string name
        string email
        int id PK
    }
    ORDER {
        int id PK
        date created
        string status
    }
    PRODUCT {
        int id PK
        string name
        float price
    }`,
  },
  {
    name: 'Gantt',
    icon: '▦',
    code: `gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Design
    Research       :a1, 2024-01-01, 7d
    Wireframes     :a2, after a1, 5d
    Mockups        :a3, after a2, 5d
    section Development
    Frontend       :b1, after a3, 14d
    Backend        :b2, after a3, 14d
    Integration    :b3, after b1, 7d
    section Launch
    Testing        :c1, after b3, 7d
    Deploy         :c2, after c1, 2d`,
  },
];
