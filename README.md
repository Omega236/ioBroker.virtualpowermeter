<h1>
	<img src="admin/virtualpowermeter.png" width="64"/>
	ioBroker.virtualpowermeter
</h1>

[![NPM version](http://img.shields.io/npm/v/iobroker.virtualpowermeter.svg)](https://www.npmjs.com/package/iobroker.virtualpowermeter)
[![Downloads](https://img.shields.io/npm/dm/iobroker.virtualpowermeter.svg)](https://www.npmjs.com/package/iobroker.virtualpowermeter)
[![Dependency Status](https://img.shields.io/david/Omega236/iobroker.virtualpowermeter.svg)](https://david-dm.org/Omega236/iobroker.virtualpowermeter)
[![Known Vulnerabilities](https://snyk.io/test/github/Omega236/ioBroker.virtualpowermeter/badge.svg)](https://snyk.io/test/github/Omega236/ioBroker.virtualpowermeter)

[![NPM](https://nodei.co/npm/iobroker.virtualpowermeter.png?downloads=true)](https://nodei.co/npm/iobroker.virtualpowermeter/)

**Tests:** Linux/Mac: [![Travis-CI](http://img.shields.io/travis/Omega236/ioBroker.virtualpowermeter/master.svg)](https://travis-ci.org/Omega236/ioBroker.virtualpowermeter)
Windows: [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/Omega236/ioBroker.virtualpowermeter?branch=master&svg=true)](https://ci.appveyor.com/project/Omega236/ioBroker-virtualpowermeter/)

## virtualpowermeter adapter for ioBroker

Erzeugt Virtuelle Strommesser

Im Smarthome hat man viele Ger�te die man zwar schalten kann, diese aber keinen integrierten Powermeter haben (meist Lichter).

Mit diesem Adapter ist das Ziel zu jedem eingestelltem Datenpunkt (�ber Custom -> MaxWatt (z.B. 60W)) zwei zus�tzliche Datenpunkte zu bef�llen -> Energy_Power (z.B. 60 W) und Energy_Total (z.B. 2501,23 Wh). Die Datenpunkte sollen noch in Gruppen zusammengef�gt werden (z.B. Licht) und hier alle zusammen addiert werden.

Mit diesen neuen Datenpunkten kann dann eine Einfache Visualiserung durchgef�hrt werden.

siehe MeinBeispiel.jpg

�ber Blockly hab ich es bereits realisiert. Mit Adapter spiele ich jetzt mal, habe keinerlei Erfahrung in JavaScript.

## Changelog


### 0.1.0
* (Lutz Sebastian) Erste Version mit Grundfunktionalität
### 0.0.1
* (Lutz Sebastian) initial release

## License
MIT License

Copyright (c) 2019 Lutz Sebastian

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