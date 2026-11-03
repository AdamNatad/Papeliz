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
      helpSection('Models for Each Task', [
        helpParagraph(
          'Once you’ve added a provider, **Models for Each Task**, under **Saved Providers**, shows the model each job uses and its provider. Choose a row to pick another:',
        ),
        helpDetailList([
          ['Chat', 'The assistant’s model chip. A pick here or on the chip changes both.'],
          ['Transcribe', 'Turns speech into text. **Automatic** uses the first provider that can, the recommended provider first. See [[choose-a-provider]].'],
          ['Draw', 'Makes and changes pictures, **Automatic** too. Draw’s model chip in Imagine is the same setting.'],
          ['Describe Picture', 'Writes a picture’s alt text. **Same as Chat** uses the chat’s model; the other choices are models that can see pictures.'],
        ]),
        helpParagraph(
          'When none of your providers can do a task, its row says so, with **Add Provider** and the providers that can. **Other Model** takes a model name you type.',
        ),
        helpParagraph('Hover over the microphone in the assistant to see which model transcribes.'),
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
        helpParagraph(
          'The same key makes and changes pictures with `muse-image-1.0` and turns speech into text with `muse-voice-transcribe-1.0`. Muse Spark writes up what you said and describes pictures. See [[pictures-and-speech]].',
        ),
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
          'The Assistant panel docks on the right. The **AI Assistant** button in the top bar, left of **Export** and the gear, opens and closes it. Its header has **New Chat**, **Imagine**, **Sessions** and **Usage**.',
        ),
        helpParagraph(
          'Until a provider is set up, the panel offers **Choose a Provider**. See [[bring-your-own-key]]. The open note’s outline and backlinks are under the file list, in **This Note**. See [[backlinks-and-outline]].',
        ),
      ]),
      helpSection('Ask, Plan and Write', [
        helpParagraph('The switch at the top of the panel picks how the assistant works:'),
        helpDetailList([
          ['Ask', 'Answers from your notes and never changes them.'],
          ['Plan', 'Asks what it needs, then writes steps you can edit. Nothing changes until you press **Build**.'],
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
        helpParagraph('The microphone beside it puts what you say into the message box, and the picture button makes a picture of what you typed. See [[pictures-and-speech]].'),
      ]),
      helpSection('Plan', [
        helpParagraph(
          'Describe what to plan. When your request leaves real choices open, the assistant asks a few questions first. **Just Plan It** skips them: the plan says what it assumed, and **Change** asks the questions again.',
        ),
        helpParagraph(
          'The plan comes as a card with steps. Click any words to change them, tick a step that’s already done so Build skips it, drag a step by its handle (or `Alt+Up` and `Alt+Down`) to move it, and choose **Add Step** for another. **Save as Note** keeps the plan without building it.',
        ),
        helpParagraph(
          '**Build** saves the plan as a checklist note in the `Plans` folder, then builds it one step at a time. Each step’s changes come as diffs under it, and the next step starts once you accept or reject them; with **Bypass Permission** on, it runs straight through. The note ticks each step as it’s done. See [[proposed-edits]].',
        ),
        helpParagraph('**Stop** ends the running step, and **Continue** starts it again. A step that fails says why, with **Retry Step** and **Skip Step**.'),
        helpParagraph('A plain question asked in Plan gets a short answer and no plan, with **Switch to Ask**.'),
      ]),
      helpSection('Pick the model', [
        helpParagraph(
          'The model chip beside **Effort** lists every model you switched on, by provider, with **AI Provider** at the end to add more. The one you pick answers your next message and your inline edits, with its own provider’s key, and stays picked until you choose another. **Models for Each Task**, in the same menu, picks the models for speech and pictures. See [[bring-your-own-key]].',
        ),
      ]),
      helpSection('What the assistant sees', [
        helpParagraph('The chip under the message box names what goes with your message. Click it to choose:'),
        helpDetailList([
          ['This Note', 'The note in front.'],
          ['Open Notes', 'Every note open in a tab.'],
          ['Selected Notes…', 'The notes you tick in **Choose Notes**, where you can search or tick them under their folders.'],
          ['A Folder…', 'One folder and its subfolders, picked in **Choose a Folder**.'],
          ['Whole Vault', 'No note goes with the message: the assistant searches and reads notes as it needs them.'],
        ]),
        helpParagraph(
          'Each choice shows how many notes it holds, and hovering over the chip lists them. A very long note goes only in part, and when the notes together run long, the rest go by name for the assistant to read as it needs. Over each of your messages, a line says what it was about.',
        ),
        helpParagraph('The choice is kept with the conversation, so a chat you reopen sees the same notes.'),
        helpParagraph('To ask about a passage, select it and choose **Ask Assistant** in the note menu. The selection goes along with your message.'),
      ]),
      helpSection('The context ring', [
        helpParagraph(
          'The ring by the message box shows how full the model’s context window is: how much of what it can take in at once this conversation already uses. It’s grey while there’s room, amber from 80% and red from 95%, and from 80% its percent shows beside it.',
        ),
        helpParagraph(
          'Hover over it, click it, or move to it with the keyboard for its card: the model, its window, this conversation’s tokens and their cost, and **Usage** for the whole vault. As the window fills, the card offers **New conversation**, since a fresh start keeps answers sharp.',
        ),
        helpParagraph(
          'When the window’s size isn’t known, the ring is dashed and the card asks for it: type it or pick a size, then **Save**. It’s kept in the provider’s **Advanced** settings.',
        ),
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
          '**Imagine** and **Transcribe**, and on a picture **Describe Picture** and **Edit Picture**. See [[pictures-and-speech]].',
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
    papelizHelpArticleSlug: 'pictures-and-speech',
    articleTitle: 'Pictures and speech with your provider',
    articleSummary: 'Make, change and describe pictures, and turn speech into text, with your own provider and key.',
    papelizHelpGroupSlug: 'assistant',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Beside Rewrite', [
        helpParagraph(
          'Select text and press `Ctrl+K`, or right-click and choose **Edit with Assistant**. Beside **Shorter**, **Rewrite**, **Fix Grammar** and **Translate** are:',
        ),
        helpDetailList([
          ['Imagine', 'Makes a picture of the selected words, or of what you type, and puts it after them.'],
          [
            'Transcribe',
            'Turns what you say, or an audio file, into written text at that place. The text comes written up, with punctuation and paragraphs; turn off **Written Up** for the words as spoken.',
          ],
          ['Describe Picture', 'With the cursor on a picture, writes its alt text.'],
          ['Edit Picture', 'Changes a picture as you ask. The changed picture is saved as a new file and the link points to it; the old file stays.'],
        ]),
        helpParagraph(
          'The note’s right-click menu has them too: **Imagine Here** or **Imagine from Selection**, **Transcribe Here**, and on a picture **Describe Picture** and **Edit Picture**. Each shows the change to accept or reject, like any edit. See [[inline-edits]].',
        ),
      ]),
      helpSection('In the chat box', [
        helpBulletList([
          '**Speak**, the microphone: record yourself, or choose an audio file. Your words go into the message box, to send as they are or after a change. When two or more people speak, each gets a label, such as Speaker A.',
          '**Imagine a Picture**, the picture button: makes a picture of what you typed, right in the chat. **Save to Vault** keeps it, and **Put in Note** shows the change to the open note, to accept. Nothing goes to the chat’s model.',
        ]),
      ]),
      helpSection('The Imagine gallery', [
        helpParagraph(
          '**Imagine**, at the top of the assistant, keeps every picture made or brought in. Make more there, with a prompt, a shape and one to four at a time, then save them to the vault or put them in a note. **Bring In a Picture**, or drop one in, to clean it and save it.',
        ),
        helpParagraph('Saved pictures go in the `Attachments` folder at the top of the vault.'),
      ]),
      helpSection('Which providers', [
        helpParagraph(
          'Each action uses a provider you added, with your own key. The recommended provider makes pictures, changes them and turns speech into text; its models are in [[choose-a-provider]]. Transcribe’s write-up uses the chat’s model, and so does Describe Picture unless you pick another.',
        ),
        helpParagraph(
          'OpenAI, Google Gemini, OpenRouter and Together make pictures too, and they and Groq turn speech into text. **Edit Picture** works with the recommended provider. **Models for Each Task**, on the gear’s **AI Provider** page, picks the model for each, and Imagine, the chat box and Edit with Assistant all use those. See [[bring-your-own-key]].',
        ),
      ]),
      helpSection('Remove C2PA', [
        helpParagraph(
          'Every picture has **Remove C2PA**, on by default. Before a picture is saved, it takes C2PA content credentials, EXIF, XMP, IPTC, text and comments out of the PNG, JPEG or WebP file, in your browser. The picture itself doesn’t change. Turn it off to keep a picture’s credentials.',
        ),
        helpNote('Pictures, prompts and audio go straight to your provider, and the microphone is used only while you record. See [[where-your-notes-live]].'),
      ]),
    ],
    relatedArticleSlugs: ['inline-edits', 'chat-with-the-assistant', 'choose-a-provider'],
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
