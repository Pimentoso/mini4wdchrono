EESchema Schematic File Version 4
EELAYER 30 0
EELAYER END
$Descr A4 11693 8268
encoding utf-8
Sheet 1 1
Title ""
Date ""
Rev ""
Comp ""
Comment1 ""
Comment2 ""
Comment3 ""
Comment4 ""
$EndDescr
$Comp
L promicro:ProMicro U0
U 1 1 5E637F37
P 4000 3850
F 0 "U0" H 4000 4887 60  0000 C CNN
F 1 "ProMicro" H 4000 4781 60  0000 C CNN
F 2 "promicro:ArduinoProMicro" H 4100 2800 60  0001 C CNN
F 3 "" H 4100 2800 60  0000 C CNN
	1    4000 3850
	1    0    0    -1  
$EndComp
$Comp
L Connector:Conn_01x03_Female JS0
U 1 1 5E63B839
P 5850 3150
F 0 "JS0" H 5878 3176 50  0000 L CNN
F 1 "Conn_01x03_Female" H 5878 3085 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical" H 5850 3150 50  0001 C CNN
F 3 "~" H 5850 3150 50  0001 C CNN
	1    5850 3150
	1    0    0    -1  
$EndComp
$Comp
L Connector:Conn_01x03_Female JS1
U 1 1 5E63C41C
P 5850 3500
F 0 "JS1" H 5878 3526 50  0000 L CNN
F 1 "Conn_01x03_Female" H 5878 3435 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical" H 5850 3500 50  0001 C CNN
F 3 "~" H 5850 3500 50  0001 C CNN
	1    5850 3500
	1    0    0    -1  
$EndComp
$Comp
L Connector:Conn_01x03_Female JS2
U 1 1 5E63CED1
P 5850 3850
F 0 "JS2" H 5878 3876 50  0000 L CNN
F 1 "Conn_01x03_Female" H 5878 3785 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical" H 5850 3850 50  0001 C CNN
F 3 "~" H 5850 3850 50  0001 C CNN
	1    5850 3850
	1    0    0    -1  
$EndComp
$Comp
L Connector:Conn_01x03_Female JRGB0
U 1 1 5E63D627
P 5850 4200
F 0 "JRGB0" H 5878 4226 50  0000 L CNN
F 1 "Conn_01x03_Female" H 5878 4135 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical" H 5850 4200 50  0001 C CNN
F 3 "~" H 5850 4200 50  0001 C CNN
	1    5850 4200
	1    0    0    -1  
$EndComp
$Comp
L Connector:Conn_01x03_Female JRGB1
U 1 1 5E63E1AD
P 5850 4550
F 0 "JRGB1" H 5878 4576 50  0000 L CNN
F 1 "Conn_01x03_Female" H 5878 4485 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical" H 5850 4550 50  0001 C CNN
F 3 "~" H 5850 4550 50  0001 C CNN
	1    5850 4550
	1    0    0    -1  
$EndComp
Text GLabel 4700 3400 2    50   Input ~ 0
VCC
Text GLabel 4700 3200 2    50   Input ~ 0
GND
Text GLabel 3300 3300 0    50   Input ~ 0
GND
Text GLabel 3300 3400 0    50   Input ~ 0
GND
Text GLabel 5650 3050 0    50   Input ~ 0
VCC
Text GLabel 5650 3400 0    50   Input ~ 0
VCC
Text GLabel 5650 3750 0    50   Input ~ 0
VCC
Text GLabel 5650 3150 0    50   Input ~ 0
GND
Text GLabel 5650 3500 0    50   Input ~ 0
GND
Text GLabel 5650 3850 0    50   Input ~ 0
GND
Text GLabel 5650 4100 0    50   Input ~ 0
GND
Text GLabel 5650 4300 0    50   Input ~ 0
VCC
Text GLabel 5650 4450 0    50   Input ~ 0
GND
Text GLabel 5650 4650 0    50   Input ~ 0
VCC
Text GLabel 5650 5700 0    50   Input ~ 0
GND
Wire Wire Line
	5650 5800 3000 5800
Wire Wire Line
	3000 3500 3300 3500
Wire Wire Line
	3200 4950 3200 3600
Wire Wire Line
	3200 3600 3300 3600
Wire Wire Line
	3150 5200 3150 3700
Wire Wire Line
	3150 3700 3300 3700
Wire Wire Line
	5650 3250 5000 3250
Wire Wire Line
	5000 3250 5000 4400
Wire Wire Line
	5000 4400 2800 4400
Wire Wire Line
	2800 4400 2800 3900
Wire Wire Line
	2800 3900 3300 3900
Wire Wire Line
	5650 3600 5050 3600
Wire Wire Line
	5050 3600 5050 4450
Wire Wire Line
	5050 4450 2750 4450
Wire Wire Line
	2750 4450 2750 4000
Wire Wire Line
	2750 4000 3300 4000
Wire Wire Line
	5650 3950 5100 3950
Wire Wire Line
	5100 3950 5100 4500
Wire Wire Line
	5100 4500 2700 4500
Wire Wire Line
	2700 4500 2700 4100
Wire Wire Line
	2700 4100 3300 4100
Wire Wire Line
	5650 4200 5300 4200
Wire Wire Line
	5300 4950 3200 4950
NoConn ~ 4700 3100
NoConn ~ 4700 3300
NoConn ~ 4700 3500
NoConn ~ 4700 3600
NoConn ~ 4700 3700
NoConn ~ 4700 3800
NoConn ~ 4700 3900
NoConn ~ 4700 4000
NoConn ~ 4700 4100
NoConn ~ 3300 3100
NoConn ~ 3300 3200
Wire Wire Line
	3000 3500 3000 5800
$Comp
L Mechanical:MountingHole H0
U 1 1 5E6408C2
P 7350 4550
F 0 "H0" H 7450 4596 50  0000 L CNN
F 1 "MountingHole" H 7450 4505 50  0000 L CNN
F 2 "MountingHole:MountingHole_2.2mm_M2" H 7350 4550 50  0001 C CNN
F 3 "~" H 7350 4550 50  0001 C CNN
	1    7350 4550
	1    0    0    -1  
$EndComp
$Comp
L Mechanical:MountingHole H1
U 1 1 5E640F0D
P 7350 4800
F 0 "H1" H 7450 4846 50  0000 L CNN
F 1 "MountingHole" H 7450 4755 50  0000 L CNN
F 2 "MountingHole:MountingHole_2.2mm_M2" H 7350 4800 50  0001 C CNN
F 3 "~" H 7350 4800 50  0001 C CNN
	1    7350 4800
	1    0    0    -1  
$EndComp
$Comp
L Connector:Conn_01x02_Female JLASER0
U 1 1 5E661891
P 7450 4050
F 0 "JLASER0" H 7478 4026 50  0000 L CNN
F 1 "Conn_01x02_Female" H 7478 3935 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical" H 7450 4050 50  0001 C CNN
F 3 "~" H 7450 4050 50  0001 C CNN
	1    7450 4050
	1    0    0    -1  
$EndComp
Text GLabel 7250 4150 0    50   Input ~ 0
VCC
Text GLabel 7250 4050 0    50   Input ~ 0
GND
Wire Wire Line
	5300 4200 5300 4550
$Comp
L Connector:Conn_01x02_Female JSPEAKER0
U 1 1 5E640A6C
P 5850 5700
F 0 "JSPEAKER0" H 5878 5676 50  0000 L CNN
F 1 "Conn_01x02_Female" H 5878 5585 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical" H 5850 5700 50  0001 C CNN
F 3 "~" H 5850 5700 50  0001 C CNN
	1    5850 5700
	1    0    0    -1  
$EndComp
Wire Wire Line
	5650 4550 5300 4550
Connection ~ 5300 4550
Wire Wire Line
	5300 4550 5300 4950
Text GLabel 5650 5450 0    50   Input ~ 0
VCC
Text GLabel 4950 5450 0    50   Input ~ 0
GND
$Comp
L Connector:Conn_01x03_Female JEX0
U 1 1 5F930EE7
P 5850 5100
F 0 "JEX0" H 5878 5126 50  0000 L CNN
F 1 "Conn_01x03_Female" H 5878 5035 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical" H 5850 5100 50  0001 C CNN
F 3 "~" H 5850 5100 50  0001 C CNN
	1    5850 5100
	1    0    0    -1  
$EndComp
Text GLabel 5650 5000 0    50   Input ~ 0
VCC
Text GLabel 5650 5100 0    50   Input ~ 0
GND
Wire Wire Line
	5650 5200 3150 5200
Wire Wire Line
	3100 5550 5250 5550
NoConn ~ 4700 4200
Wire Wire Line
	3100 5550 3100 4200
Wire Wire Line
	3100 4200 3300 4200
NoConn ~ 3300 3800
$Comp
L Mechanical:MountingHole H2
U 1 1 5FD3A4F1
P 7350 5050
F 0 "H2" H 7450 5096 50  0000 L CNN
F 1 "MountingHole" H 7450 5005 50  0000 L CNN
F 2 "MountingHole:MountingHole_2.2mm_M2" H 7350 5050 50  0001 C CNN
F 3 "~" H 7350 5050 50  0001 C CNN
	1    7350 5050
	1    0    0    -1  
$EndComp
$Comp
L Device:R_US R0
U 1 1 5FD3B002
P 5100 5450
F 0 "R0" V 4895 5450 50  0000 C CNN
F 1 "R_US" V 4986 5450 50  0000 C CNN
F 2 "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal" V 5140 5440 50  0001 C CNN
F 3 "~" H 5100 5450 50  0001 C CNN
	1    5100 5450
	0    1    1    0   
$EndComp
$Comp
L Connector:Conn_01x02_Female JBUTTON0
U 1 1 5FD41B09
P 5850 5450
F 0 "JBUTTON0" H 5878 5426 50  0000 L CNN
F 1 "Conn_01x02_Female" H 5878 5335 50  0000 L CNN
F 2 "Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical" H 5850 5450 50  0001 C CNN
F 3 "~" H 5850 5450 50  0001 C CNN
	1    5850 5450
	1    0    0    -1  
$EndComp
Wire Wire Line
	5250 5450 5250 5550
Connection ~ 5250 5550
Wire Wire Line
	5250 5550 5650 5550
$EndSCHEMATC
