// The website's own script: the theme switch, the folder list (a drawer on phones) and search.
// It is a plain script and loads its data from script files, not with fetch, so the site also works
// opened straight from disk. Every name and note title is placed as text, never as HTML.
;(function () {
  'use strict'

  var rootElement = document.documentElement
  var siteRootHref = rootElement.getAttribute('data-papeliz-site-root-href') || ''
  var sitePagePath = rootElement.getAttribute('data-papeliz-site-page-path') || ''
  var svgNamespace = 'http://www.w3.org/2000/svg'
  var themePreferenceStorageKey = 'papelizSiteThemePreference'
  var largestSearchResultCount = 12

  function getSiteHref(siteFilePath) {
    return siteRootHref + siteFilePath.split('/').map(encodeURIComponent).join('/')
  }

  function createSvgIcon(svgShapeDescriptions, iconSizePixels) {
    var svgElement = document.createElementNS(svgNamespace, 'svg')
    var svgAttributes = {
      width: String(iconSizePixels),
      height: String(iconSizePixels),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    }
    Object.keys(svgAttributes).forEach(function (svgAttributeName) {
      svgElement.setAttribute(svgAttributeName, svgAttributes[svgAttributeName])
    })
    svgShapeDescriptions.forEach(function (svgShapeDescription) {
      var svgShapeElement = document.createElementNS(svgNamespace, svgShapeDescription[0])
      Object.keys(svgShapeDescription[1]).forEach(function (svgShapeAttributeName) {
        svgShapeElement.setAttribute(svgShapeAttributeName, svgShapeDescription[1][svgShapeAttributeName])
      })
      svgElement.appendChild(svgShapeElement)
    })
    return svgElement
  }

  // The theme: Light, Dark or Match this device, kept in this browser.

  var deviceDarkThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  var themeSwitchElement = document.querySelector('.papeliz-site-theme-switch')

  function readThemePreference() {
    try {
      return window.localStorage.getItem(themePreferenceStorageKey) || 'device'
    } catch (storageError) {
      return 'device'
    }
  }

  function showThemePreference(themePreference) {
    var isDarkTheme = themePreference === 'dark' || (themePreference !== 'light' && deviceDarkThemeQuery.matches)
    rootElement.setAttribute('data-papeliz-site-theme', isDarkTheme ? 'dark' : 'light')
    if (themeSwitchElement === null) return
    themeSwitchElement.querySelectorAll('[data-papeliz-site-theme-choice]').forEach(function (themeChoiceButton) {
      themeChoiceButton.setAttribute('aria-pressed', String(themeChoiceButton.getAttribute('data-papeliz-site-theme-choice') === themePreference))
    })
  }

  if (themeSwitchElement !== null) {
    themeSwitchElement.hidden = false
    themeSwitchElement.addEventListener('click', function (clickEvent) {
      var themeChoiceButton = clickEvent.target.closest('[data-papeliz-site-theme-choice]')
      if (themeChoiceButton === null) return
      var themePreference = themeChoiceButton.getAttribute('data-papeliz-site-theme-choice')
      try {
        window.localStorage.setItem(themePreferenceStorageKey, themePreference)
      } catch (storageError) {
        // Not kept (a private window); the page still switches.
      }
      showThemePreference(themePreference)
    })
  }
  deviceDarkThemeQuery.addEventListener('change', function () {
    showThemePreference(readThemePreference())
  })
  window.addEventListener('storage', function (storageEvent) {
    if (storageEvent.key === themePreferenceStorageKey) showThemePreference(readThemePreference())
  })
  showThemePreference(readThemePreference())

  // The folder list, from papeliz-site-navigation.js.

  var navigationElement = document.getElementById('papeliz-site-navigation')
  var siteNavigation = window.papelizSiteNavigation

  function buildFolderTree(siteNotePages) {
    var rootFolder = { folderName: '', childFolders: [], childFoldersByName: new Map(), notePages: [], holdsCurrentPage: false }
    siteNotePages.forEach(function (siteNotePage) {
      var noteFolder = rootFolder
      var isCurrentPage = siteNotePage.notePagePath === sitePagePath
      siteNotePage.noteFolderNames.forEach(function (noteFolderName) {
        var childFolder = noteFolder.childFoldersByName.get(noteFolderName)
        if (childFolder === undefined) {
          childFolder = { folderName: noteFolderName, childFolders: [], childFoldersByName: new Map(), notePages: [], holdsCurrentPage: false }
          noteFolder.childFoldersByName.set(noteFolderName, childFolder)
          noteFolder.childFolders.push(childFolder)
        }
        if (isCurrentPage) childFolder.holdsCurrentPage = true
        noteFolder = childFolder
      })
      noteFolder.notePages.push(siteNotePage)
    })
    return rootFolder
  }

  function createFolderList(noteFolder) {
    var folderListElement = document.createElement('ul')
    noteFolder.childFolders.forEach(function (childFolder) {
      var folderItemElement = document.createElement('li')
      var folderDetailsElement = document.createElement('details')
      var folderSummaryElement = document.createElement('summary')
      var folderNameElement = document.createElement('span')
      folderNameElement.textContent = childFolder.folderName
      folderSummaryElement.appendChild(createSvgIcon([['path', { d: 'm9 18 6-6-6-6' }]], 14))
      folderSummaryElement.appendChild(folderNameElement)
      folderDetailsElement.open = childFolder.holdsCurrentPage
      folderDetailsElement.appendChild(folderSummaryElement)
      folderDetailsElement.appendChild(createFolderList(childFolder))
      folderItemElement.appendChild(folderDetailsElement)
      folderListElement.appendChild(folderItemElement)
    })
    noteFolder.notePages.forEach(function (siteNotePage) {
      var noteItemElement = document.createElement('li')
      var noteLinkElement = document.createElement('a')
      noteLinkElement.href = getSiteHref(siteNotePage.notePagePath)
      noteLinkElement.textContent = siteNotePage.notePageTitle
      if (siteNotePage.notePagePath === sitePagePath) noteLinkElement.setAttribute('aria-current', 'page')
      noteItemElement.appendChild(noteLinkElement)
      folderListElement.appendChild(noteItemElement)
    })
    return folderListElement
  }

  if (navigationElement !== null && siteNavigation !== undefined) {
    var homeLinkElement = navigationElement.querySelector('.papeliz-site-navigation-home')
    if (homeLinkElement !== null && sitePagePath === 'index.html') homeLinkElement.setAttribute('aria-current', 'page')
    var folderTreeElement = createFolderList(buildFolderTree(siteNavigation.siteNotePages))
    folderTreeElement.className = 'papeliz-site-tree'
    navigationElement.appendChild(folderTreeElement)
    var currentPageLinkElement = navigationElement.querySelector('[aria-current="page"]')
    if (currentPageLinkElement !== null) {
      navigationElement.scrollTop = Math.max(0, currentPageLinkElement.offsetTop - navigationElement.clientHeight / 2)
    }
  }

  // On phones the folder list is a drawer under the Notes button.

  var menuButtonElement = document.querySelector('.papeliz-site-menu-button')

  function setDrawerOpen(isDrawerOpen) {
    rootElement.classList.toggle('papeliz-site-drawer-open', isDrawerOpen)
    if (menuButtonElement !== null) menuButtonElement.setAttribute('aria-expanded', String(isDrawerOpen))
  }

  if (menuButtonElement !== null && navigationElement !== null) {
    rootElement.classList.add('papeliz-site-has-drawer')
    menuButtonElement.hidden = false
    menuButtonElement.addEventListener('click', function () {
      setDrawerOpen(!rootElement.classList.contains('papeliz-site-drawer-open'))
    })
    document.addEventListener('click', function (clickEvent) {
      if (!rootElement.classList.contains('papeliz-site-drawer-open')) return
      if (navigationElement.contains(clickEvent.target) && clickEvent.target.closest('a') === null) return
      if (menuButtonElement.contains(clickEvent.target)) return
      setDrawerOpen(false)
    })
  }

  // Search, over papeliz-site-search-index.js, loaded the first time it is needed.

  var searchElement = document.querySelector('.papeliz-site-search')
  var searchFieldElement = document.querySelector('.papeliz-site-search-field')
  var searchResultsElement = document.getElementById('papeliz-site-search-results')
  var preparedSearchNotes = null
  var isSearchIndexLoading = false
  var selectedSearchResultIndex = -1

  function foldSearchText(searchText) {
    return searchText.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }

  function prepareSearchNotes(siteSearchNotes) {
    return siteSearchNotes.map(function (siteSearchNote) {
      return {
        siteSearchNote: siteSearchNote,
        foldedTitle: foldSearchText(siteSearchNote.notePageTitle),
        foldedHeadings: foldSearchText(siteSearchNote.noteHeadings.join('\n')),
        foldedFolderPath: foldSearchText(siteSearchNote.noteFolderPath),
        foldedText: foldSearchText(siteSearchNote.noteText),
      }
    })
  }

  function loadSearchIndex() {
    if (preparedSearchNotes !== null || isSearchIndexLoading) return
    if (window.papelizSiteSearchIndex !== undefined) {
      preparedSearchNotes = prepareSearchNotes(window.papelizSiteSearchIndex.siteSearchNotes)
      return
    }
    isSearchIndexLoading = true
    var searchIndexScriptElement = document.createElement('script')
    searchIndexScriptElement.src = siteRootHref + 'papeliz-site/papeliz-site-search-index.js'
    searchIndexScriptElement.onload = function () {
      isSearchIndexLoading = false
      preparedSearchNotes = prepareSearchNotes(window.papelizSiteSearchIndex.siteSearchNotes)
      showSearchResults()
    }
    searchIndexScriptElement.onerror = function () {
      isSearchIndexLoading = false
      showSearchMessage('Search couldn’t load.')
    }
    document.head.appendChild(searchIndexScriptElement)
  }

  // Every word must match somewhere; titles count most, then headings, folders and text.
  function findSearchResults(searchQuery) {
    var searchWords = foldSearchText(searchQuery).split(/\s+/).filter(Boolean)
    if (searchWords.length === 0) return []
    var searchResults = []
    preparedSearchNotes.forEach(function (preparedSearchNote) {
      var searchScore = 0
      var matchesEveryWord = searchWords.every(function (searchWord) {
        var wordScore = 0
        if (preparedSearchNote.foldedTitle.indexOf(searchWord) !== -1) wordScore += preparedSearchNote.foldedTitle.indexOf(searchWord) === 0 ? 16 : 10
        if (preparedSearchNote.foldedHeadings.indexOf(searchWord) !== -1) wordScore += 5
        if (preparedSearchNote.foldedFolderPath.indexOf(searchWord) !== -1) wordScore += 2
        if (preparedSearchNote.foldedText.indexOf(searchWord) !== -1) wordScore += 1
        searchScore += wordScore
        return wordScore > 0
      })
      if (matchesEveryWord) searchResults.push({ preparedSearchNote: preparedSearchNote, searchScore: searchScore })
    })
    searchResults.sort(function (firstResult, secondResult) {
      return secondResult.searchScore - firstResult.searchScore || firstResult.preparedSearchNote.foldedTitle.localeCompare(secondResult.preparedSearchNote.foldedTitle)
    })
    return searchResults.slice(0, largestSearchResultCount)
  }

  // A short piece of the note's text around the first word found, with the words marked.
  function createSearchSnippet(noteText, searchQuery) {
    var searchWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    var lowerCaseNoteText = noteText.toLowerCase()
    var firstMatchIndex = -1
    searchWords.forEach(function (searchWord) {
      var searchWordIndex = lowerCaseNoteText.indexOf(searchWord)
      if (searchWordIndex !== -1 && (firstMatchIndex === -1 || searchWordIndex < firstMatchIndex)) firstMatchIndex = searchWordIndex
    })
    var snippetStartIndex = Math.max(0, firstMatchIndex - 50)
    var snippetText = (snippetStartIndex > 0 ? '…' : '') + noteText.slice(snippetStartIndex, snippetStartIndex + 140) + (noteText.length > snippetStartIndex + 140 ? '…' : '')
    var snippetElement = document.createElement('span')
    snippetElement.className = 'papeliz-site-search-result-snippet'
    var escapedSearchWords = searchWords.map(function (searchWord) {
      return searchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    if (escapedSearchWords.length === 0) {
      snippetElement.textContent = snippetText
      return snippetElement
    }
    var searchWordPattern = new RegExp('(' + escapedSearchWords.join('|') + ')', 'gi')
    snippetText.split(searchWordPattern).forEach(function (snippetPart, snippetPartIndex) {
      if (snippetPartIndex % 2 === 1) {
        var markElement = document.createElement('mark')
        markElement.textContent = snippetPart
        snippetElement.appendChild(markElement)
      } else if (snippetPart.length > 0) {
        snippetElement.appendChild(document.createTextNode(snippetPart))
      }
    })
    return snippetElement
  }

  function setSearchResultsShown(isShown) {
    searchResultsElement.hidden = !isShown
    searchFieldElement.setAttribute('aria-expanded', String(isShown))
    if (!isShown) searchFieldElement.removeAttribute('aria-activedescendant')
  }

  function showSearchMessage(searchMessage) {
    var messageElement = document.createElement('p')
    messageElement.className = 'papeliz-site-search-empty'
    messageElement.textContent = searchMessage
    searchResultsElement.replaceChildren(messageElement)
    setSearchResultsShown(true)
  }

  function selectSearchResult(searchResultIndex) {
    var searchResultElements = searchResultsElement.querySelectorAll('.papeliz-site-search-result')
    if (searchResultElements.length === 0) return
    selectedSearchResultIndex = (searchResultIndex + searchResultElements.length) % searchResultElements.length
    searchResultElements.forEach(function (searchResultElement, resultElementIndex) {
      searchResultElement.setAttribute('aria-selected', String(resultElementIndex === selectedSearchResultIndex))
    })
    var selectedResultElement = searchResultElements[selectedSearchResultIndex]
    searchFieldElement.setAttribute('aria-activedescendant', selectedResultElement.id)
    selectedResultElement.scrollIntoView({ block: 'nearest' })
  }

  function showSearchResults() {
    var searchQuery = searchFieldElement.value.trim()
    selectedSearchResultIndex = -1
    if (searchQuery.length === 0) {
      setSearchResultsShown(false)
      return
    }
    if (preparedSearchNotes === null) {
      showSearchMessage('Loading search…')
      loadSearchIndex()
      return
    }
    var searchResults = findSearchResults(searchQuery)
    if (searchResults.length === 0) {
      showSearchMessage('No notes match “' + searchQuery + '”.')
      return
    }
    searchResultsElement.replaceChildren()
    searchResults.forEach(function (searchResult, searchResultIndex) {
      var siteSearchNote = searchResult.preparedSearchNote.siteSearchNote
      var resultLinkElement = document.createElement('a')
      resultLinkElement.className = 'papeliz-site-search-result'
      resultLinkElement.id = 'papeliz-site-search-result-' + searchResultIndex
      resultLinkElement.href = getSiteHref(siteSearchNote.notePagePath)
      resultLinkElement.setAttribute('role', 'option')
      resultLinkElement.setAttribute('aria-selected', 'false')
      var titleElement = document.createElement('span')
      titleElement.className = 'papeliz-site-search-result-title'
      titleElement.textContent = siteSearchNote.notePageTitle
      resultLinkElement.appendChild(titleElement)
      if (siteSearchNote.noteFolderPath.length > 0) {
        var folderElement = document.createElement('span')
        folderElement.className = 'papeliz-site-search-result-folder'
        folderElement.textContent = siteSearchNote.noteFolderPath
        resultLinkElement.appendChild(folderElement)
      }
      resultLinkElement.appendChild(createSearchSnippet(siteSearchNote.noteText, searchQuery))
      searchResultsElement.appendChild(resultLinkElement)
    })
    setSearchResultsShown(true)
  }

  if (searchElement !== null && searchFieldElement !== null && searchResultsElement !== null) {
    searchElement.hidden = false
    searchFieldElement.addEventListener('focus', loadSearchIndex)
    searchFieldElement.addEventListener('input', showSearchResults)
    searchFieldElement.addEventListener('keydown', function (keyEvent) {
      if (keyEvent.key === 'ArrowDown' || keyEvent.key === 'ArrowUp') {
        keyEvent.preventDefault()
        if (searchResultsElement.hidden) showSearchResults()
        selectSearchResult(selectedSearchResultIndex + (keyEvent.key === 'ArrowDown' ? 1 : -1))
      } else if (keyEvent.key === 'Enter') {
        var chosenResultElement = searchResultsElement.querySelectorAll('.papeliz-site-search-result')[Math.max(0, selectedSearchResultIndex)]
        if (chosenResultElement !== undefined) {
          keyEvent.preventDefault()
          window.location.href = chosenResultElement.href
        }
      } else if (keyEvent.key === 'Escape') {
        if (searchFieldElement.value.length > 0 && searchResultsElement.hidden) searchFieldElement.value = ''
        setSearchResultsShown(false)
      }
    })
    document.addEventListener('click', function (clickEvent) {
      if (!searchElement.contains(clickEvent.target)) setSearchResultsShown(false)
    })
  }

  document.addEventListener('keydown', function (keyEvent) {
    if (keyEvent.key === 'Escape') setDrawerOpen(false)
    // "/" jumps to search, as on many documentation sites.
    var typingTarget = keyEvent.target
    var isTyping = typingTarget instanceof HTMLInputElement || typingTarget instanceof HTMLTextAreaElement || (typingTarget instanceof HTMLElement && typingTarget.isContentEditable)
    if (keyEvent.key === '/' && !isTyping && searchFieldElement !== null && !keyEvent.ctrlKey && !keyEvent.metaKey && !keyEvent.altKey) {
      keyEvent.preventDefault()
      searchFieldElement.focus()
    }
  })
})()
