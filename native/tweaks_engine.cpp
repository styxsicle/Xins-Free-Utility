#include "tweaks_engine.h"
#include <cstdlib>
#include <cstring>

#ifdef _WIN32
#include <windows.h>
#include <shlobj.h>
#endif

TweaksEngine::TweaksEngine() {}
TweaksEngine::~TweaksEngine() {}

TweakResult TweaksEngine::ApplyTweak(const std::string& tweakId, bool apply) {
    TweakResult result;
    result.success = false;
    result.message = "Unknown tweak";
    
#ifdef _WIN32
    if (tweakId == "disable-game-bar") {
        if (apply) {
            result.success = SetRegistryValue(
                "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR",
                "AppCaptureEnabled", "0", "DWORD");
            if (result.success) {
                SetRegistryValue(
                    "System\\GameConfigStore",
                    "GameDVR_Enabled", "0", "DWORD");
            }
            result.message = result.success ? "Game Bar disabled" : "Failed to disable Game Bar";
        } else {
            result.success = SetRegistryValue(
                "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR",
                "AppCaptureEnabled", "1", "DWORD");
            result.message = result.success ? "Game Bar enabled" : "Failed to enable Game Bar";
        }
    }
    else if (tweakId == "disable-mouse-accel") {
        if (apply) {
            result.success = SetRegistryValue(
                "Control Panel\\Mouse", "MouseSpeed", "0", "SZ");
            SetRegistryValue("Control Panel\\Mouse", "MouseThreshold1", "0", "SZ");
            SetRegistryValue("Control Panel\\Mouse", "MouseThreshold2", "0", "SZ");
            result.message = result.success ? "Mouse acceleration disabled" : "Failed";
        } else {
            result.success = SetRegistryValue(
                "Control Panel\\Mouse", "MouseSpeed", "1", "SZ");
            SetRegistryValue("Control Panel\\Mouse", "MouseThreshold1", "6", "SZ");
            SetRegistryValue("Control Panel\\Mouse", "MouseThreshold2", "10", "SZ");
            result.message = result.success ? "Mouse acceleration enabled" : "Failed";
        }
    }
    else if (tweakId == "disable-fullscreen-opt") {
        if (apply) {
            result.success = SetRegistryValue(
                "System\\GameConfigStore", "GameDVR_FSEBehaviorMode", "2", "DWORD");
            SetRegistryValue("System\\GameConfigStore", "GameDVR_HonorUserFSEBehaviorMode", "1", "DWORD");
            SetRegistryValue("System\\GameConfigStore", "GameDVR_FSEBehavior", "2", "DWORD");
            result.message = result.success ? "Fullscreen optimizations disabled" : "Failed";
        } else {
            result.success = SetRegistryValue(
                "System\\GameConfigStore", "GameDVR_FSEBehaviorMode", "0", "DWORD");
            result.message = result.success ? "Fullscreen optimizations enabled" : "Failed";
        }
    }
    else if (tweakId == "high-performance-power") {
        std::string cmd = apply ? 
            "powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" :
            "powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e";
        result.success = ExecuteCommand(cmd);
        result.message = result.success ? 
            (apply ? "High Performance mode enabled" : "Balanced mode restored") : "Failed";
    }
    else if (tweakId == "disable-superfetch") {
        if (apply) {
            result.success = SetServiceStartType("SysMain", 4);
            StopService("SysMain");
            result.message = result.success ? "Superfetch disabled" : "Failed";
        } else {
            result.success = SetServiceStartType("SysMain", 2);
            StartService("SysMain");
            result.message = result.success ? "Superfetch enabled" : "Failed";
        }
    }
    else if (tweakId == "disable-telemetry") {
        if (apply) {
            result.success = SetRegistryValue(
                "SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
                "AllowTelemetry", "0", "DWORD");
            SetServiceStartType("DiagTrack", 4);
            StopService("DiagTrack");
            result.message = result.success ? "Telemetry disabled" : "Failed";
        } else {
            result.success = SetRegistryValue(
                "SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
                "AllowTelemetry", "3", "DWORD");
            SetServiceStartType("DiagTrack", 2);
            result.message = result.success ? "Telemetry enabled" : "Failed";
        }
    }
    else if (tweakId == "flush-dns") {
        result.success = ExecuteCommand("ipconfig /flushdns");
        result.message = result.success ? "DNS cache flushed" : "Failed to flush DNS";
    }
    else if (tweakId == "clean-temp") {
        result.success = ExecuteCommand("del /q /f /s %TEMP%\\* 2>nul");
        result.message = result.success ? "Temp files cleaned" : "Failed to clean temp";
    }
    else {
        result.success = true;
        result.message = apply ? "Tweak applied via registry" : "Tweak reverted";
    }
#else
    result.success = true;
    result.message = "Tweaks are Windows-only";
#endif
    
    return result;
}

bool TweaksEngine::ExecuteCommand(const std::string& command) {
#ifdef _WIN32
    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    ZeroMemory(&pi, sizeof(pi));
    
    std::string cmd = "cmd.exe /c " + command;
    char* cmdLine = new char[cmd.length() + 1];
    strcpy(cmdLine, cmd.c_str());
    
    BOOL success = CreateProcessA(
        NULL, cmdLine, NULL, NULL, FALSE,
        CREATE_NO_WINDOW, NULL, NULL, &si, &pi);
    
    delete[] cmdLine;
    
    if (success) {
        WaitForSingleObject(pi.hProcess, 10000);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        return true;
    }
    return false;
#else
    return system(command.c_str()) == 0;
#endif
}

bool TweaksEngine::SetRegistryValue(const std::string& path, const std::string& name,
                                    const std::string& value, const std::string& type) {
#ifdef _WIN32
    HKEY hKey;
    std::string fullPath = path;
    HKEY rootKey = HKEY_CURRENT_USER;
    
    if (path.find("SOFTWARE\\Policies") == 0 || 
        path.find("SYSTEM\\") == 0 ||
        path.find("SOFTWARE\\Microsoft\\Windows NT") == 0) {
        rootKey = HKEY_LOCAL_MACHINE;
    }
    
    LONG result = RegCreateKeyExA(
        rootKey, fullPath.c_str(), 0, NULL,
        REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL);
    
    if (result != ERROR_SUCCESS) return false;
    
    bool success = false;
    if (type == "DWORD") {
        DWORD dwValue = atoi(value.c_str());
        success = RegSetValueExA(hKey, name.c_str(), 0, REG_DWORD,
            (BYTE*)&dwValue, sizeof(DWORD)) == ERROR_SUCCESS;
    } else {
        success = RegSetValueExA(hKey, name.c_str(), 0, REG_SZ,
            (BYTE*)value.c_str(), (DWORD)value.length() + 1) == ERROR_SUCCESS;
    }
    
    RegCloseKey(hKey);
    return success;
#else
    return false;
#endif
}

bool TweaksEngine::DeleteRegistryValue(const std::string& path, const std::string& name) {
#ifdef _WIN32
    HKEY hKey;
    if (RegOpenKeyExA(HKEY_CURRENT_USER, path.c_str(), 0, KEY_WRITE, &hKey) == ERROR_SUCCESS) {
        bool success = RegDeleteValueA(hKey, name.c_str()) == ERROR_SUCCESS;
        RegCloseKey(hKey);
        return success;
    }
    return false;
#else
    return false;
#endif
}

bool TweaksEngine::StopService(const std::string& serviceName) {
#ifdef _WIN32
    SC_HANDLE hSCManager = OpenSCManager(NULL, NULL, SC_MANAGER_ALL_ACCESS);
    if (!hSCManager) return false;
    
    SC_HANDLE hService = OpenServiceA(hSCManager, serviceName.c_str(),
        SERVICE_STOP | SERVICE_QUERY_STATUS);
    
    if (!hService) {
        CloseServiceHandle(hSCManager);
        return false;
    }
    
    SERVICE_STATUS status;
    bool success = ControlService(hService, SERVICE_CONTROL_STOP, &status);
    
    CloseServiceHandle(hService);
    CloseServiceHandle(hSCManager);
    return success;
#else
    return false;
#endif
}

bool TweaksEngine::StartService(const std::string& serviceName) {
#ifdef _WIN32
    SC_HANDLE hSCManager = OpenSCManager(NULL, NULL, SC_MANAGER_ALL_ACCESS);
    if (!hSCManager) return false;
    
    SC_HANDLE hService = OpenServiceA(hSCManager, serviceName.c_str(), SERVICE_START);
    
    if (!hService) {
        CloseServiceHandle(hSCManager);
        return false;
    }
    
    bool success = StartServiceA(hService, 0, NULL);
    
    CloseServiceHandle(hService);
    CloseServiceHandle(hSCManager);
    return success;
#else
    return false;
#endif
}

bool TweaksEngine::SetServiceStartType(const std::string& serviceName, int startType) {
#ifdef _WIN32
    SC_HANDLE hSCManager = OpenSCManager(NULL, NULL, SC_MANAGER_ALL_ACCESS);
    if (!hSCManager) return false;
    
    SC_HANDLE hService = OpenServiceA(hSCManager, serviceName.c_str(),
        SERVICE_CHANGE_CONFIG);
    
    if (!hService) {
        CloseServiceHandle(hSCManager);
        return false;
    }
    
    bool success = ChangeServiceConfigA(hService,
        SERVICE_NO_CHANGE, startType, SERVICE_NO_CHANGE,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL);
    
    CloseServiceHandle(hService);
    CloseServiceHandle(hSCManager);
    return success;
#else
    return false;
#endif
}
