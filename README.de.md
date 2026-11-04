# dsh-language-bridge

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | **Deutsch** | [Русский](README.ru.md) | [Português](README.pt.md)

Lokales Plugin für DeepSeek Harness: **Lege für jedes Modell eine Arbeitssprache fest.** Du schreibst in deiner eigenen
Sprache, DeepSeek Flash übersetzt den Text in die Arbeitssprache des Modells und sendet ihn dann; die Antwort des Modells
wird zurück in deine Sprache übersetzt und an derselben Stelle angezeigt. Jede Sprache und jedes Modell lässt sich konfigurieren.

Beispiel: Du schreibst Spanisch, Claude und Gemini sind auf Englisch eingestellt und ein chinesisches Modell auf `zh-CN`.

<p align="center">
  <img src="docs/demo.gif" width="932" alt="Frage auf Chinesisch an Claude: Das Modell erhält Englisch und antwortet auf Englisch, die Oberfläche zeigt die chinesische Übersetzung; mit „Original anzeigen“ und „Gesendeten Text anzeigen“ lässt sich umschalten">
</p>

Im Bild oben ist deine Sprache `auto` (folgt der chinesischen Oberfläche) und die Arbeitssprache von Claude Englisch. Nach
dem Ende der Antwort wird sie automatisch durch die chinesische Übersetzung ersetzt; „Original anzeigen“ (查看原文) zeigt
die englische Antwort des Modells, „Gesendeten Text anzeigen“ (查看发送内容) den englischen Text, der tatsächlich an das
Modell ging. Die Demo wurde mit der chinesischen Oberfläche aufgenommen.

## Funktionen

- **Regeln Modell → Sprache**: Geordnete Liste; die Modell-id wird per Regex abgeglichen (ohne Beachtung der
  Groß-/Kleinschreibung), die erste passende Regel gilt. Modelle ohne passende Regel bleiben unverändert.
- **Deine Sprache**: Beliebiger BCP-47-Code (`es`, `ja`, `zh-CN` …) oder `auto`, um der Oberflächensprache zu folgen.
- **Eingabeübersetzung**: Vor dem Senden wird dein Text in die Arbeitssprache übersetzt. Codeblöcke, Inline-Code, Links und
  `@Pfade` bleiben unverändert.
- **Antwortübersetzung**: Nach jeder Runde wird die Antwort durch die Übersetzung ersetzt; mit „Original anzeigen“ /
  „Übersetzung anzeigen“ schaltest du an Ort und Stelle um. Denkinhalte werden nicht übersetzt.
- **Arbeitssprache beibehalten**: Für überbrückte Modelle wird dem Systemprompt eine Regel hinzugefügt, die das Modell
  anweist, auch dann in der Arbeitssprache zu denken und zu antworten, wenn Tool-Ausgaben in anderen Sprachen ankommen.
- **Sichtbare Fehler**: Schlägt die Übersetzung fehl, wird der Originaltext wie gewohnt gesendet, die Runde geht nicht
  verloren, und unter der Nachricht erscheint eine Warnung.
- **Keine Kosten bei gleicher Sprache**: Sind deine Sprache und die Arbeitssprache des Modells gleich (z. B. `en-GB` und
  `en`), wird nicht übersetzt, kein Systemprompt ergänzt und es entstehen keine Kosten.

<p align="center">
  <img src="docs/translation-failed.png" width="740" alt="Wenn die Übersetzung fehlschlägt, erscheint unter der Nachricht „⚠ Übersetzung fehlgeschlagen: Das Modell hat deinen Originaltext erhalten“">
</p>

## Installation

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" plugin --profile desktop add link:$HOME/.dsh/local-plugins/dsh-language-bridge
```

Starte DeepSeek Harness danach neu und lade die Seite neu.

**Umstieg von `claude-zh-bridge`**: Aktiviere die beiden Plugins nicht gleichzeitig, sonst wird doppelt übersetzt.
Entferne zuerst das alte Plugin und installiere dann das neue:

```sh
"$DSH" plugin --profile desktop remove @local/claude-zh-bridge
```

Alte Sitzungen sind nicht betroffen: Der vom alten Plugin gespeicherte Originaltext (`source.claudeZhBridge`) wird weiterhin
angezeigt, bereits bezahlte Übersetzungen werden direkt wiederverwendet (siehe unten „Kompatibilität mit alten Sitzungen“).

**Entfernen**: Auf der Seite „Plugins“ in DSH deaktivieren oder deinstallieren, oder
`"$DSH" plugin --profile desktop remove dsh-language-bridge` ausführen.

## Einstellungen

Öffne „Plugins → Language Bridge“. Nach dem Speichern gelten die Änderungen ab dem nächsten Schritt, ein Neustart ist
nicht nötig.

<p align="center">
  <img src="docs/settings.gif" width="833" alt="Regel qwen → zh-CN hinzufügen: Ungültige Regex werden sofort gemeldet, der Test einer Modell-id zeigt die passende Regel, nach dem Speichern gilt sie">
</p>

- **Your language** (deine Sprache): Bei `auto` meldet der Browser die Oberflächensprache an den Host, der sie speichert;
  die Oberflächensprache `zh` wird als `zh-CN` behandelt.
- **Model rules** (Modellregeln): Regeln lassen sich hinzufügen, löschen und nach oben oder unten verschieben. Regex und
  Sprachcodes werden im Formular sofort geprüft; solange Fehler bestehen, kann nicht gespeichert werden.
- **Test a model id** (Modell-id testen): Gib eine Modell-id ein und sieh, welche Regel greift und ob übersetzt werden muss.

Standardregeln:

| Regex für Modell-id | Arbeitssprache |
| --- | --- |
| `claude` | `en` |
| `gemini` | `en` |
| `(^\|[^a-z0-9])(chat)?gpt($\|[^a-z])` | `en` |

Die GPT-Regel hat Wortgrenzen: Sie passt auf `gpt-5`, `openai/gpt-4o`, `chatgpt-4o` und `gpt-oss`, trifft aber nicht
versehentlich ids wie `egpt-1` oder `mygpt`.

Die Einstellungen werden in `$DSH_HOME/storages/language-bridge.json` gespeichert und haben Vorrang vor
`cordis.patch.yml`. Du kannst auch in `cordis.patch.yml` mit `rules` und `userLanguage` Anfangswerte setzen und mit
`provider` (`auto` / `deepseek-official` / `deepseek-account`), `translateInput` und `translateOutput` das Verhalten
anpassen.

## Funktionsweise

```text
Deine Eingabe ──► Spracherkennung ──► Übersetzung (DeepSeek Flash) ──► Modell (Arbeitssprache + Systemprompt-Regel)
                                                                                │
Angezeigte Antwort ◄── Übersetzung (DeepSeek Flash) ◄── Spracherkennung ◄───────┘
```

| Datei | Ort | Aufgabe |
| --- | --- | --- |
| `index.js` | Host | `agent/pre-step` übersetzt die Eingabe; Abschnitt im Systemprompt; Endpunkte `/api/language-bridge/*` (Antwortübersetzung, Einstellungen lesen/schreiben, Oberflächensprache melden; nur für den Owner) |
| `rules.js` | Gemeinsam | Regelabgleich, Prüfung von Sprachcodes, Zusammenführen der Einstellungen, Systemprompt-Text (reine Funktionen) |
| `detect.js` | Gemeinsam | Prüft, ob ein Text noch übersetzt werden muss (reine Funktionen) |
| `protect.js` | Gemeinsam | Schützt Code und Links mit Platzhaltern, übersetzt in Blöcken |
| `client.js` | Browser | Ersetzen und Umschalten der Antwort an Ort und Stelle, „Gesendeten Text anzeigen“ / „Original anzeigen“ und Fehlerwarnung bei Nutzernachrichten, Einstellungsseite |
| `cordis.patch.yml` | Patch | Fügt die Zeile für den translator-Dienst und die Zeile für dieses Plugin ein |

- Übersetzt wird über das in dsh enthaltene `@deepseek-ai/dsh-experimental-translator`, bevorzugt über
  `deepseek-official` (API key), sonst über `deepseek-account`. Bezahlte Ergebnisse werden in der Sitzung gespeichert und
  beim erneuten Öffnen nicht noch einmal berechnet.
- Der Originaltext liegt in `source.languageBridge` der Nachricht; das Modell sieht ihn nicht, er dient nur der Anzeige.
- Übersetzt werden nur deine eigenen Nachrichten; vom System eingefügter Kontext und Nachrichten von Subagenten nicht.
- Lässt das Übersetzungsmodell Platzhalter weg, wird nur noch der Text zwischen den Platzhaltern übersetzt, damit Code und
  Links nicht verloren gehen.
- Die Einstellungsseite nutzt den Slot `plugins.bundle.config` der Plugin-Detailseite statt des eingebauten
  Konfigurationsformulars von Harness: Letzteres braucht `schemastery`, und über `link:` installierte lokale Plugins
  können dieses Paket nicht auflösen.

## Spracherkennung

`needsTranslation(text, { target, source })` entscheidet, ob ein Text noch in `target` übersetzt werden muss, und prüft
dabei der Reihe nach:

1. **Nicht-Fließtext entfernen**: Geschützte Abschnitte sowie Wörter, die wie Code aussehen (`parseConfig`, `foo_bar`,
   `src/app.ts`, `v2`, `--flag`, Abkürzungen). Bleiben keine Buchstaben übrig, wird nicht übersetzt.
2. **Schriften vergleichen**: Die Schrift der Zielsprache wird mit `Intl.Locale` ermittelt, eine Sprachtabelle ist nicht
   nötig. Ist der Anteil einer anderen nicht-lateinischen Schrift hoch genug, wird übersetzt. Ist die Zielschrift nicht
   lateinisch, gilt Text erst dann als fremdsprachig, wenn lateinische Buchstaben über 60 % ausmachen, weil englische
   Begriffe in chinesischen, japanischen, koreanischen und russischen Texten häufig vorkommen.
3. **Funktionswörter vergleichen**: Sprachen mit derselben Schrift (z. B. Spanisch und Englisch) werden anhand
   eingebauter Funktionswortlisten für 17 Sprachen unterschieden. Überwiegt deutlich eine andere Sprache, wird übersetzt;
   überwiegt deutlich die Zielsprache, nicht.
4. **Weiterhin unklar**: Nur wenn deine Sprache und die Zielsprache unterschiedliche Schriften verwenden, wird nicht
   übersetzt (ein japanischsprachiger Nutzer tippt `run tests`); in allen anderen Fällen wird übersetzt.

Der Grundsatz lautet **lieber einmal zu viel übersetzen als etwas übersehen**. Eine überflüssige Übersetzung kostet nur
einen kleinen DeepSeek-Flash-Betrag, und ist die Übersetzung identisch mit dem Original, wird nichts ersetzt und kein
Umschaltknopf angezeigt; eine übersehene Übersetzung dagegen bedeutet, dass das Modell Text in der falschen Sprache
erhält, ohne dass es jemand bemerkt. Der Preis dafür:

- Tippt ein spanischsprachiger Nutzer einen kurzen Satz ohne Funktionswörter wie `run tests`, gibt es einen zusätzlichen
  Aufruf;
- Bei Sprachpaaren mit derselben Schrift ohne Funktionswortliste (z. B. indonesischsprachiger Nutzer, Modell auf Swahili)
  wird für jeden Abschnitt ein Aufruf ausgelöst;
- Besteht ein Text nur aus Han-Zeichen, lassen sich Chinesisch und Japanisch sowie vereinfachte und traditionelle Schrift
  nicht unterscheiden; dann wird so verfahren, als sei eine Übersetzung nötig.

## Kompatibilität mit alten Sitzungen

Das alte Plugin `claude-zh-bridge` speicherte den Originaltext in `source.claudeZhBridge`; dieses Feld bleibt lesbar. Der
Schlüssel des Übersetzungscaches enthält Textabschnitt, Sprache und Route. Dieses Plugin verwendet dieselben Platzhalter
und dieselbe Blockaufteilung (durch Unit-Tests abgesichert), sodass die Übersetzungen alter Sitzungen direkt
wiederverwendet werden, wenn deine Sprache zu `zh-CN` aufgelöst wird.

## Entwicklung

```sh
node --test test/*.test.js
```

Die Tests decken Reihenfolge und Abgleich der Regeln ab, die Spracherkennung (Latein ↔ Latein, CJK/Kyrillisch/Arabisch/
Devanagari in beide Richtungen, gemischte Bezeichner), geschützte Abschnitte, den Platzhalter-Fallback sowie das Lesen des
alten Felds und die Anzeige der Fehlerwarnung.

Nach Änderungen an `index.js` oder `cordis.patch.yml` muss DeepSeek Harness neu gestartet werden; ändert sich die
Oberfläche nach Änderungen an `client.js` nicht, installiere das Plugin neu und lade die Seite neu.

## Bekannte Einschränkungen

- **Die Systemprompt-Regel erhöht nur die Wahrscheinlichkeit, sie erzwingt nichts.** In Tests haben Modelle sie
  ignoriert: Als die Übersetzung fehlschlug und Claude direkt Japanisch erhielt, antwortete es auf Japanisch; als die
  Regel erst mitten in der Sitzung hinzukam, antwortete Gemini Flash Lite mit bestehendem spanischem Verlauf weiter auf
  Spanisch. Ist eine Antwort bereits in deiner Sprache, wird sie nicht erneut übersetzt.
- Welche Denkinhalte sichtbar sind, hängt von der Modellroute ab und ist eventuell nur eine Zusammenfassung; sind sie
  nicht sichtbar, lässt sich nicht prüfen, in welcher Sprache das Modell denkt.
- Geschützt sind nur Codeblöcke, Inline-Code, Links und `@Pfade`. Befehle und Zitate ohne Backticks werden ebenfalls
  übersetzt, etwa der String in `printf "..."`. Setze alles, was nicht übersetzt werden soll, in Backticks. Auch ein
  chinesischer Abschnitt in einem englischen Satz wird übersetzt.
- Sitzungsprotokoll und Modelleingabe enthalten die Übersetzung (das Plugin kann Nachrichten nur vor dem Schreiben
  umschreiben); der Originaltext dient nur der Anzeige.
- Die Antwort wird erst nach Ende der Runde durch die Übersetzung ersetzt; während der Generierung siehst du den
  Originaltext des Modells.
- Mit `auto` lässt sich nicht feststellen, ob die Sprachen gleich sind, bevor der Browser die Oberflächensprache gemeldet
  hat; bis dahin entscheidet allein die Spracherkennung.
- Jeder nicht zwischengespeicherte Textabschnitt ist eine kostenpflichtige DeepSeek-Flash-Anfrage.
- Knopf- und Warntexte gibt es in acht Sprachen: Chinesisch, Englisch, Japanisch, Spanisch, Französisch, Deutsch,
  Russisch und Portugiesisch; die Einstellungsseite gibt es nur auf Chinesisch und Englisch, andere Sprachen sehen sie auf
  Englisch.
- Ist gleichzeitig das offizielle Bundle „推理翻译“ (Reasoning-Übersetzung) aktiviert, bringen beide je einen eigenen
  translator-Dienst mit, was zu Konflikten führen kann.
- Das Plugin übernimmt die Darstellung der Nutzernachrichten; ändert ein Harness-Update die Chat-Struktur, kann eine
  Anpassung nötig sein.
