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
    articleSummary: 'Connect the assistant to an AI provider with your own API key. No Papeliz account needed.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('How it works', [
        helpParagraph(
          'Papeliz has no AI service of its own. You pick a provider, paste an API key from your account with that provider, and the assistant sends its requests straight from your browser to that provider.',
        ),
        helpParagraph('The provider bills you for what you use, under its own terms.'),
      ]),
      helpSection('Set it up', [
        helpNumberedSteps([
          'Open the Assistant panel and choose **Set up the assistant**, or the **Provider and API key** button at the top of the panel.',
          'Pick a provider, and its base URL fills in. See [[choose-a-provider]].',
          'Paste your API key. Servers running on your own computer usually don’t need one.',
          'Choose **Load models**, then pick a model from the provider’s list.',
          'Choose **Test connection** to check that it works, then **Save and use**.',
        ]),
      ]),
      helpSection('Models come from the provider’s list', [
        helpParagraph(
          'For every preset except Custom, the model comes from the list the provider returns for your key, so a mistyped model name can’t be saved. Custom also takes a typed name.',
        ),
      ]),
      helpSection('Change or remove a key', [
        helpParagraph('Open **Provider and API key** again to switch provider or model. **Forget this key** removes the key from this browser.'),
      ]),
    ],
    relatedArticleSlugs: [papelizHelpProviderArticleSlug, 'where-your-key-goes', 'chat-with-the-assistant'],
  },
  {
    papelizHelpArticleSlug: papelizHelpProviderArticleSlug,
    articleTitle: 'Choose a provider',
    articleSummary: 'Presets fill in the base URL for popular providers, and any OpenAI-compatible service works.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('Recommended: Muse Spark on the Meta Model API', [
        helpParagraph(
          'The first preset, selected out of the box, is Muse Spark on the Meta Model API. Its long context lets the assistant work across many notes at once, and the API accepts calls straight from the browser.',
        ),
        helpDetailList([
          ['Base URL', '`https://api.meta.ai/v1`'],
          ['Model', '`muse-spark-1.3`'],
          ['API key', 'From the Model API dashboard at `dev.meta.ai`'],
        ]),
      ]),
      helpSection('Other presets', [
        helpParagraph('Papeliz speaks the OpenAI-compatible format, so any other compatible provider works too. The presets:'),
        helpBulletList([
          '**OpenAI**.',
          '**OpenRouter**: many hosted models behind one key.',
          '**Groq**, **Together** and **Fireworks**: hosted open-weights models.',
          '**Google Gemini**, through Google’s OpenAI-compatible endpoint.',
          '**Ollama Cloud**, **OpenCode Zen** and **OpenCode Go**: hosted models with a key from those services.',
          '**Ollama** and **LM Studio** running on your own computer, with no key.',
          '**Custom**: any other OpenAI-compatible base URL.',
        ]),
      ]),
      helpSection('Calls from the browser', [
        helpParagraph(
          'Papeliz calls the provider from your browser, so the provider has to accept calls from a web page. That has been checked for the recommended preset and OpenAI. For the others, **Test connection** tells you.',
        ),
      ]),
      helpSection('Models on your own computer', [
        helpParagraph(
          'To use Ollama on your computer, add Papeliz’s web address to Ollama’s `OLLAMA_ORIGINS` setting so it accepts calls from the page. For LM Studio, start its local server with CORS turned on in the server settings. Then pick the matching preset.',
        ),
      ]),
      helpSection('Custom', [
        helpParagraph(
          'Choose **Custom** for any other service that speaks the OpenAI Chat Completions format. Enter its base URL, which usually ends in `/v1`, and a key if it needs one.',
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
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('The Assistant panel', [
        helpParagraph(
          'The Assistant panel docks on the right, with three tabs: **Chat**, **Backlinks** and **Outline**. The button at the right end of the top bar opens and closes it.',
        ),
      ]),
      helpSection('Ask', [
        helpNumberedSteps([
          'Type in the message box at the bottom of the panel.',
          'Press `Enter` to send, or `Shift+Enter` for a new line.',
          'The answer appears as it’s written. Choose **Stop** to end it early.',
        ]),
      ]),
      helpSection('What the assistant sees', [
        helpParagraph(
          'The chip under the message box shows what goes with your message: the open note, or **Whole vault**. Click it to switch. With the whole vault, the assistant searches and reads notes as it needs them.',
        ),
        helpParagraph('To ask about a passage, select it and choose **Ask Assistant** in the note menu. The selection goes along with your message.'),
      ]),
      helpSection('Answers that link to your notes', [
        helpParagraph('When an answer draws on your notes, it links them as wikilinks. Click one to open that note.'),
      ]),
      helpSection('Saved chats', [
        helpParagraph(
          'Each conversation is saved as an ordinary Markdown note in a **Chat Sessions** folder in your vault, so it travels with the folder. **Chat history** reopens an earlier chat, and **New chat** starts a fresh one.',
        ),
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
    papelizHelpArticleAvailability: 'in-development',
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
          'In the Assistant panel’s actions menu, **Suggest links across notes** looks for places where one note mentions another note’s subject without linking to it, and proposes turning those words into wikilinks, one proposal per note. **Suggest tags** proposes tags for your notes.',
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
    papelizHelpArticleAvailability: 'in-development',
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
          '**Fix grammar**: spelling and grammar fixes.',
          '**Translate**: into your browser’s language, or into English if the text already is in it.',
        ]),
      ]),
      helpSection('Review the change', [
        helpParagraph(
          'The change shows in place as a diff. **Accept** (`Ctrl+Enter`) replaces the selection, **Try again** asks for another version, and **Reject** (`Esc`) leaves your text as it was.',
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
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('Turn it on', [
        helpParagraph(
          'Press `Ctrl+Shift+F` or choose the focus button in the top bar. The file list and the Assistant panel step away, and a large message box floats at the bottom of the note.',
        ),
      ]),
      helpSection('Ask without leaving the note', [
        helpParagraph('Send a message from the floating box. The latest answer rises above it, and you can put it away when you’re done.'),
      ]),
      helpSection('Leave focus mode', [
        helpParagraph('Press `Esc` or `Ctrl+Shift+F`, or choose **Exit focus** in the top bar.'),
      ]),
    ],
    relatedArticleSlugs: ['chat-with-the-assistant', 'keyboard-shortcuts'],
  },
]
