<h1>
	<img src="admin/virtualpowermeter.png" width="64"/>
	ioBroker.virtualpowermeter
</h1>

![node](https://img.shields.io/node/v/iobroker.virtualpowermeter.svg)
![Number of Installations](http://iobroker.live/badges/virtualpowermeter-installed.svg) ![Number of Installations](http://iobroker.live/badges/virtualpowermeter-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.virtualpowermeter.svg)](https://www.npmjs.com/package/iobroker.virtualpowermeter)
[![Downloads](https://img.shields.io/npm/dm/iobroker.virtualpowermeter.svg)](https://www.npmjs.com/package/iobroker.virtualpowermeter)
[![Dependency Status](https://img.shields.io/david/Omega236/iobroker.virtualpowermeter.svg)](https://david-dm.org/Omega236/iobroker.virtualpowermeter)
[![Known Vulnerabilities](https://snyk.io/test/github/Omega236/ioBroker.virtualpowermeter/badge.svg)](https://snyk.io/test/github/Omega236/ioBroker.virtualpowermeter)

[![NPM](https://nodei.co/npm/iobroker.virtualpowermeter.png?downloads=true)](https://nodei.co/npm/iobroker.virtualpowermeter/)

**Tests:** Linux/Mac: [![Travis-CI](http://img.shields.io/travis/Omega236/ioBroker.virtualpowermeter/master.svg)](https://travis-ci.org/Omega236/ioBroker.virtualpowermeter)
Windows: [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/Omega236/ioBroker.virtualpowermeter?branch=master&svg=true)](https://ci.appveyor.com/project/Omega236/ioBroker-virtualpowermeter/)
![License](https://img.shields.io/npm/l/iobroker.virtualpowermeter.svg)
## virtualpowermeter adapter for ioBroker

Erzeugt Virtuelle Strommesser

Im Smarthome hat man viele Geräte die man zwar schalten kann, diese aber keinen integrierten Powermeter haben (meist Lichter).

Mit diesem Adapter ist das Ziel zu jedem eingestelltem Datenpunkt (über Custom -> MaxWatt (z.B. 60W)) zwei zusätzliche Datenpunkte zu befüllen -> Energy_Power (z.B. 60 W) und Energy_Total (z.B. 2501,23 Wh). 
Zusätzlich werden Gruppen gebildet (diese werden unter virtualpowermeter.0.xxx abgelegt) die die summe der einzelnen Datenpunkte darstellt

Mit diesen neuen Datenpunkten kann dann eine Einfache Visualiserung durchgeführt werden.

Die neuen Datenpunkte (besonders die Gruppen) könnten super mit valuetrackerovertime weiterverarbeitet werden

Die neuen Datenpunkte für Power und Total werden normal im gleichen Verzeichnis wie die überwachten States abgelegt. Sobald der Pfad einen "." enthält wird das Verzeichnis als Absolut betrachtet und unter dieser id abgelegt. Hier ist es sinnvoll die Datenpunkte in das eigene virtualpowermeter.0 abzulegen (aufpassen dass man die Ids nicht doppelt verwendet.)
<img src="https://user-images.githubusercontent.com/25373047/104218659-5920eb80-543d-11eb-8e20-774822d489a7.png" />

Beispiel mit valuetrackerovertime:
<img src="MeinBeispiel2.jpg" />


## Changelog
### 1.3.0 (2021-01-15)
* (scrounger) default ids for power and energie configurable through adapter settings
* (scrounger) custom: autocomplete for group input added
* (scrounger) option added -> group energy values can only increase 
* (Omega236) Check duplicate Destination DP
* (Omega236n) allows to Set Destination of DP
### 1.2.2 (2020-12-26
* (Omega236) Group Calculations only after InitialFinished
### 1.2.1 (2020-04-15)
* (Omega236) translation
### 1.2.0 (2020-04-15)
* (Omega236) js-controller 3.x support
### 1.1.1 (2020-04-07)
* (Omega236) bugfix translation
### 1.1.0 (2020-04-05)
* (Omega236) inverted added
### 1.0.1
* (Omega236) SecurityUpdates
### 1.0.0
* (Omega236) Final Release
### 0.2.8
* (Omega236) Bug found on travis unsubscribeStatesAsync
### 0.2.6
* (Omega236) texts adapted
### 0.2.5
* (Omega236) awaits missing
### 0.2.4
* (Omega236) var remove and SettingPage Info and dic in class and .bind(this) (Template 1.10)
### 0.2.3
* (Omega236) CodeOptimierung nach eslint
### 0.2.1
* (Omega236) CodeOptimierung und bild
### 0.2.0
* (Omega236) Alle Funktionen implementiert, code noch nicht überprüft/optimiert/getestet
### 0.1.0
* (Omega236) Erste Version mit Grundfunktionalität
### 0.0.1
* (Omega236) initial release

## License
MIT License

Copyright (c) 2021 Omega236 general.of.omega@googlemail.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
