Option Explicit
Dim shell, files, studioRoot
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
studioRoot = files.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = studioRoot
shell.Run "node """ & studioRoot & "\scripts\launch.mjs""", 0, False
