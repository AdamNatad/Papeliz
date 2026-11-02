import {
  helpBulletList,
  helpDetailList,
  helpNote,
  helpNumberedSteps,
  helpParagraph,
  helpSection,
  type PapelizHelpArticle,
} from './papeliz-help-content-blocks'

export const papelizHelpProviderArticleSlug = 'choose-a-provider'

export const papelizHelpAssistantArticles: readonly PapelizHelpArticle[] = [
  {
    papelizHelpArticleSlug: 'bring-your-own-key',
    articleTitle: 'Bring your own key',
    articleSummary: 'Connect the assistant to one or more AI providers with your own API keys. No Papeliz account needed.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('How it works', [
        helpParagraph(
          'Papeliz has no AI service of its own. You add one or more providers, each with an API key from your account there, and the assistant sends each request straight from your browser to the provider of the model you picked.',
        ),
        helpParagraph('Each provider bills you for what you use, under its own terms.'),
      ]),
      helpSection('Add a provider', [
        helpNumberedSteps([
          'Open the gear at the right end of the top bar and choose **AI Provider**, or choose **Choose a Provider** in the Assistant panel. The page lists your **Saved Providers**.',
          'Choose **Add Provider**. One window opens, with the **Provider** menu at the top: pick a provider there, or type to search for one. Its key, models and settings show under the menu, and its base URL fills in. See [[choose-a-provider]].',
          'Paste your API key. Servers on your own computer usually don’t need one.',
          'Choose **Test Connection**. It loads the provider’s models, switches on the recommended one, and sends one tiny request.',
          'Choose **Add Provider** at the bottom of the window. It stays off until the test passes and a model is on.',
        ]),
        helpParagraph(
          'Add as many providers as you like. They’re all in use at once: the model chip in the assistant lists the models you switched on, by provider. See [[chat-with-the-assistant]].',
        ),
      ]),
      helpSection('Switch models on', [
        helpParagraph(
          'Under **Models** in a provider’s settings, switch on the models you want: they show on the model chip in the assistant. For every preset except Custom, models come from the list the provider returns for your key, so a mistyped name can’t be added. Custom also takes a typed name with **Add Model**.',
        ),
      ]),
      helpSection('Model price', [
        helpParagraph(
          'Usage estimates what the assistant costs from each model’s listed price, taken from the provider’s price page. If you pay a different price, choose **Price** beside the model in its provider’s settings and type yours, per million input and output tokens. Leave both boxes empty to use the listed price. Papeliz itself is free; your providers bill you.',
        ),
      ]),
      helpSection('Change or remove a provider', [
        helpParagraph(
          'Choose a provider’s gear under **Saved Providers** to change its key, switch models on or off, or open **Advanced**: the base URL, the context window, the longest answer (**Max Output**) and the temperature. A new key or address must pass **Test Connection** before **Save**. **Remove Provider** erases its key and models from this browser.',
        ),
      ]),
    ],
    relatedArticleSlugs: [papelizHelpProviderArticleSlug, 'where-your-key-goes', 'chat-with-the-assistant'],
  },
  {
    papelizHelpArticleSlug: papelizHelpProviderArticleSlug,
    articleTitle: 'Choose a provider',
    articleSummary: 'Presets fill in the base URL for popular providers, and any OpenAI-compatible service works.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Recommended: the Meta Model API', [
        helpParagraph(
          'The first preset is the Meta Model API, with the Muse Spark models (`muse-spark-1.3` and `muse-spark-1.1`). Their long context lets the assistant work across many notes at once, and the API accepts calls straight from the browser.',
        ),
        helpDetailList([
          ['Base URL', '`https://api.meta.ai/v1`'],
          ['Model', '`muse-spark-1.3`'],
          ['API key', 'From the Model API dashboard at `dev.meta.ai`'],
        ]),
      ]),
      helpSection('Other presets', [
        helpParagraph('Papeliz speaks the OpenAI-compatible format, so any other compatible provider works too. In **Add Provider**’s **Provider** menu, the hosted presets come first, then **Local** and **Any Other**:'),
        helpBulletList([
          'The hosted presets: **Claude**, Anthropic’s Claude models (Papeliz sends Anthropic’s header for calls from a browser page with each Claude request); **OpenAI**; **OpenRouter**, many hosted models behind one key; **Groq**, **Together** and **Fireworks**, hosted open-weights models; **Google Gemini**, through Google’s OpenAI-compatible endpoint; **DeepSeek**, DeepSeek’s V4 models, Flash and Pro.',
          '**Local**: **Ollama Local** and **LM Studio Local**, on your own computer, with no key.',
          '**Any Other**: **Custom**, any other OpenAI-compatible base URL.',
        ]),
        helpParagraph('A provider you already saved shows **Saved** and can’t be added twice.'),
      ]),
      helpSection('Calls from the browser', [
        helpParagraph(
          'Papeliz calls the provider from your browser, so the provider has to accept calls from a web page. Every hosted preset listed has been checked to accept them. Providers that refuse them, such as Ollama Cloud and OpenCode, aren’t offered in the web app. For Custom, **Test Connection** tells you.',
        ),
      ]),
      helpSection('Models on your own computer', [
        helpParagraph(
          'To use **Ollama Local**, add Papeliz’s web address to Ollama’s `OLLAMA_ORIGINS` setting so it accepts calls from the page. For **LM Studio Local**, start LM Studio’s local server with CORS turned on in the server settings. Then add the matching preset.',
        ),
      ]),
      helpSection('Custom', [
        helpParagraph(
          'Choose **Custom** for any other service that speaks the OpenAI Chat Completions format. Enter its base URL, which usually ends in `/v1`, and a key if it needs one, then type its model names with **Add Model**.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['bring-your-own-key', 'where-your-key-goes'],
  },
  {
    papelizHelpArticleSlug: 'chat-with-the-assistant',
    articleTitle: 'Chat with the assistant',
    articleSummary: 'Ask about the open note or the whole vault, and get answers that link to your notes.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('The Assistant panel', [
        helpParagraph(
          'The Assistant panel docks on the right. The **AI Assistant** button in the top bar, left of **Export** and the gear, opens and closes it. Its header has **New Chat**, **Sessions** and **Usage**.',
        ),
        helpParagraph(
          'Until a provider is set up, the panel offers **Choose a Provider**. See [[bring-your-own-key]]. The open note’s outline and backlinks are under the file list, in **This Note**. See [[backlinks-and-outline]].',
        ),
      ]),
      helpSection('Ask, Plan and Write', [
        helpParagraph('The switch at the top of the panel picks how the assistant works:'),
        helpDetailList([
          ['Ask', 'Answers from your notes and never changes them.'],
          ['Plan', 'Turns an idea into a step-by-step plan. **Write It** has the assistant carry it out, and **Save as Note** keeps the plan as a note.'],
          ['Write', 'Edits, adds and deletes notes, and you review each change. **Bypass Permission**, under **In Write** in the Effort chip’s menu, applies changes at once instead.'],
        ]),
      ]),
      helpSection('Ask', [
        helpNumberedSteps([
          'Type in the message box at the bottom of the panel.',
          'Press `Enter` to send, or `Shift+Enter` for a new line.',
          'The answer appears as it’s written. Choose **Stop** to end it early.',
        ]),
        helpParagraph(
          'While it answers, a message you send is read before its next step, or choose to send it when the answer ends. The chip beside the model sets the **Effort**: how long the model thinks before it answers.',
        ),
        helpParagraph('Add files or pictures with **+** beside the message box, or paste or drop them into it.'),
      ]),
      helpSection('Pick the model', [
        helpParagraph(
          'The model chip beside **Effort** lists every model you switched on, by provider, with **AI Provider** at the end to add more. The one you pick answers your next message and your inline edits, with its own provider’s key, and stays picked until you choose another. See [[bring-your-own-key]].',
        ),
      ]),
      helpSection('What the assistant sees', [
        helpParagraph(
          'The chip under the message box shows what goes with your message: the open note, or **Whole Vault**. Click it to switch. With the whole vault, the assistant searches and reads notes as it needs them.',
        ),
        helpParagraph('To ask about a passage, select it and choose **Ask Assistant** in the note menu. The selection goes along with your message.'),
      ]),
      helpSection('Answers that link to your notes', [
        helpParagraph('When an answer draws on your notes, it links them as wikilinks. Click one to open that note.'),
      ]),
      helpSection('Pictures in answers', [
        helpParagraph(
          'A picture from another website in an answer waits behind a **Show** button, with its site’s name, so nothing loads from that site until you ask. Pictures in Mermaid diagrams never load from other sites.',
        ),
      ]),
      helpSection('Saved chats', [
        helpParagraph(
          'Each conversation is saved as an ordinary Markdown note in the vault’s hidden `.csessions` folder, so it travels with the folder. **Sessions** reopens an earlier chat, and **New Chat** starts a fresh one. **Show Hidden**, at the bottom of the file list, shows the folder.',
        ),
        helpParagraph('**Usage** shows the tokens the assistant used and what they cost, for each model.'),
        helpNote('Your messages, and the notes the assistant reads, go to your provider. See [[where-your-key-goes]].'),
      ]),
    ],
    relatedArticleSlugs: ['proposed-edits', 'inline-edits', 'bring-your-own-key'],
  },
  {
    papelizHelpArticleSlug: 'proposed-edits',
    articleTitle: 'Review proposed edits',
    articleSummary: 'Every change the assistant wants to make arrives as a diff you accept or reject.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Nothing changes until you accept', [
        helpParagraph(
          'When the assistant wants to change a note or create one, it shows a card with the change as a diff: removed words in red, added words in green. **Accept** writes it to the file, and **Reject** drops it. Until then, your notes stay as they are.',
        ),
      ]),
      helpSection('Undo an accepted edit', [
        helpParagraph('An accepted edit to an open note lands as a single change, so `Ctrl+Z` in the note takes it back.'),
      ]),
      helpSection('Suggest links and tags', [
        helpParagraph(
          'On a new chat, **Suggest Links** looks for places where one note mentions another note’s subject without linking to it, and proposes turning those words into wikilinks, one proposal per note. **Suggest Tags** proposes tags for your notes.',
        ),
        helpParagraph('Each suggestion is a card of its own, so you review every note’s change before anything is written.'),
      ]),
    ],
    relatedArticleSlugs: ['chat-with-the-assistant', 'inline-edits'],
  },
  {
    papelizHelpArticleSlug: 'inline-edits',
    articleTitle: 'Edit a selection in place',
    articleSummary: 'Select text and ask for Shorter, Rewrite, Fix grammar or Translate.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Open the edit box', [
        helpNumberedSteps([
          'Select text in a note.',
          'Press `Ctrl+K`, or right-click and choose **Edit with Assistant**.',
          'Type what should change and press `Enter`, or pick a quick action.',
        ]),
      ]),
      helpSection('Quick actions', [
        helpBulletList([
          '**Shorter**: the same point in fewer words.',
          '**Rewrite**: a fresh version of the passage.',
          '**Fix Grammar**: spelling and grammar fixes.',
          '**Translate**: into your browser’s language, or into English if the text already is in it.',
        ]),
      ]),
      helpSection('Review the change', [
        helpParagraph(
          'The change shows in place as a diff. **Accept** (`Ctrl+Enter`) replaces the selection, **Try Again** asks for another version, and **Reject** (`Esc`) leaves your text as it was.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['proposed-edits', 'format-text', 'chat-with-the-assistant'],
  },
  {
    papelizHelpArticleSlug: 'focus-mode',
    articleTitle: 'Focus mode',
    articleSummary: 'Just your note, with a floating message box for the assistant.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Turn it on', [
        helpParagraph(
          'Press `Ctrl+Shift+F`, or open the gear at the right end of the top bar, choose **Accessibility** and turn on **Focus Mode**. The file list and the Assistant panel step away, and a large message box floats at the bottom of the note.',
        ),
      ]),
      helpSection('Ask without leaving the note', [
        helpParagraph('Send a message from the floating box. The latest answer rises above it, and you can put it away when you’re done.'),
      ]),
      helpSection('Leave focus mode', [
        helpParagraph('Press `Esc` or `Ctrl+Shift+F`, choose **Exit Focus** in the top bar, or turn off **Focus Mode** on the gear’s **Accessibility** page.'),
      ]),
    ],
    relatedArticleSlugs: ['chat-with-the-assistant', 'keyboard-shortcuts'],
  },
]
