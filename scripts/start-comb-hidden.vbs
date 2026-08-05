' Launch the Comb local server with no console window (used by the logon task).
Set shell = CreateObject("WScript.Shell")
combDir = "C:\Users\Breyten\OneDrive\Desktop\HIVE\Comb"
shell.CurrentDirectory = combDir
shell.Run """C:\Program Files\nodejs\node.exe"" """ & combDir & "\serve.js""", 0, False
