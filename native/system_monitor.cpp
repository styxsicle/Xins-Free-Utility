#include "system_monitor.h"
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <fstream>
#include <sstream>

#ifdef _WIN32
#include <Wbemidl.h>
#include <comdef.h>
#include <pdh.h>
#include <windows.h>
#pragma comment(lib, "pdh.lib")
#pragma comment(lib, "wbemuuid.lib")
#else
#include <sys/sysinfo.h>
#include <sys/utsname.h>
#include <unistd.h>
#endif

SystemMonitor::SystemMonitor() {
#ifdef _WIN32
  pLoc = nullptr;
  pSvc = nullptr;
  InitializeWMI();
#endif
}

SystemMonitor::~SystemMonitor() {
#ifdef _WIN32
  CleanupWMI();
#endif
}

#ifdef _WIN32
void SystemMonitor::InitializeWMI() {
  HRESULT hres;

  hres = CoInitializeEx(0, COINIT_MULTITHREADED);
  if (FAILED(hres))
    return;

  hres =
      CoInitializeSecurity(NULL, -1, NULL, NULL, RPC_C_AUTHN_LEVEL_DEFAULT,
                           RPC_C_IMP_LEVEL_IMPERSONATE, NULL, EOAC_NONE, NULL);

  if (FAILED(hres)) {
    CoUninitialize();
    return;
  }

  hres = CoCreateInstance(CLSID_WbemLocator, 0, CLSCTX_INPROC_SERVER,
                          IID_IWbemLocator, (LPVOID *)&pLoc);

  if (FAILED(hres)) {
    CoUninitialize();
    return;
  }

  hres = ((IWbemLocator *)pLoc)
             ->ConnectServer(_bstr_t(L"ROOT\\CIMV2"), NULL, NULL, 0, NULL, 0, 0,
                             (IWbemServices **)&pSvc);

  if (FAILED(hres)) {
    ((IWbemLocator *)pLoc)->Release();
    pLoc = nullptr;
    CoUninitialize();
    return;
  }

  hres = CoSetProxyBlanket((IWbemServices *)pSvc, RPC_C_AUTHN_WINNT,
                           RPC_C_AUTHZ_NONE, NULL, RPC_C_AUTHN_LEVEL_CALL,
                           RPC_C_IMP_LEVEL_IMPERSONATE, NULL, EOAC_NONE);
}

void SystemMonitor::CleanupWMI() {
  if (pSvc) {
    ((IWbemServices *)pSvc)->Release();
    pSvc = nullptr;
  }
  if (pLoc) {
    ((IWbemLocator *)pLoc)->Release();
    pLoc = nullptr;
  }
  CoUninitialize();
}
#endif

SystemInfo SystemMonitor::GetSystemInfo() {
  SystemInfo info;

#ifdef _WIN32
  SYSTEM_INFO sysInfo;
  GetSystemInfo(&sysInfo);
  info.cpuCores = sysInfo.dwNumberOfProcessors;

  char cpuName[256] = "Unknown CPU";
  HKEY hKey;
  if (RegOpenKeyExA(HKEY_LOCAL_MACHINE,
                    "HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", 0,
                    KEY_READ, &hKey) == ERROR_SUCCESS) {
    DWORD size = sizeof(cpuName);
    RegQueryValueExA(hKey, "ProcessorNameString", NULL, NULL, (LPBYTE)cpuName,
                     &size);
    RegCloseKey(hKey);
  }
  info.cpuModel = cpuName;

  DWORD mhz = 0;
  if (RegOpenKeyExA(HKEY_LOCAL_MACHINE,
                    "HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", 0,
                    KEY_READ, &hKey) == ERROR_SUCCESS) {
    DWORD size = sizeof(mhz);
    RegQueryValueExA(hKey, "~MHz", NULL, NULL, (LPBYTE)&mhz, &size);
    RegCloseKey(hKey);
  }
  info.cpuSpeed = (int)mhz;

  MEMORYSTATUSEX memInfo;
  memInfo.dwLength = sizeof(MEMORYSTATUSEX);
  GlobalMemoryStatusEx(&memInfo);
  info.totalMemory = memInfo.ullTotalPhys;
  info.freeMemory = memInfo.ullAvailPhys;

  OSVERSIONINFOEXA osInfo;
  ZeroMemory(&osInfo, sizeof(OSVERSIONINFOEXA));
  osInfo.dwOSVersionInfoSize = sizeof(OSVERSIONINFOEXA);

  typedef NTSTATUS(WINAPI * RtlGetVersionPtr)(PRTL_OSVERSIONINFOW);
  HMODULE hMod = GetModuleHandleW(L"ntdll.dll");
  if (hMod) {
    RtlGetVersionPtr fxPtr =
        (RtlGetVersionPtr)GetProcAddress(hMod, "RtlGetVersion");
    if (fxPtr != nullptr) {
      RTL_OSVERSIONINFOW rovi = {0};
      rovi.dwOSVersionInfoSize = sizeof(rovi);
      if (fxPtr(&rovi) == 0) {
        std::stringstream ss;
        ss << rovi.dwMajorVersion << "." << rovi.dwMinorVersion << "."
           << rovi.dwBuildNumber;
        info.release = ss.str();
      }
    }
  }

  info.platform = "win32";

  char hostname[256];
  DWORD hostnameSize = sizeof(hostname);
  GetComputerNameA(hostname, &hostnameSize);
  info.hostname = hostname;

  info.uptime = GetTickCount64() / 1000;

#else
  struct sysinfo si;
  sysinfo(&si);

  info.cpuCores = sysconf(_SC_NPROCESSORS_ONLN);

  std::ifstream cpuinfo("/proc/cpuinfo");
  std::string line;
  while (std::getline(cpuinfo, line)) {
    if (line.find("model name") != std::string::npos) {
      info.cpuModel = line.substr(line.find(":") + 2);
      break;
    }
  }

  info.cpuSpeed = 0;
  std::ifstream freqFile(
      "/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq");
  if (freqFile.is_open()) {
    int freq;
    freqFile >> freq;
    info.cpuSpeed = freq / 1000;
  }

  info.totalMemory = si.totalram * si.mem_unit;
  info.freeMemory = si.freeram * si.mem_unit;

  struct utsname uts;
  uname(&uts);
  info.platform = uts.sysname;
  info.release = uts.release;
  info.hostname = uts.nodename;

  info.uptime = si.uptime;
  return info;
#endif
}

LiveStats SystemMonitor::GetLiveStats() {
  LiveStats stats;

  stats.cpuUsage = (int)GetCpuUsage();
  stats.cpuTemp = GetCpuTemperature();
  stats.gpuTemp = GetGpuTemperature();
  stats.gpuUsage = GetGpuUsage();
  stats.diskUsage = GetDiskUsage();
  GetNetworkStats(stats.networkUp, stats.networkDown);

#ifdef _WIN32
  MEMORYSTATUSEX memInfo;
  memInfo.dwLength = sizeof(MEMORYSTATUSEX);
  GlobalMemoryStatusEx(&memInfo);
  stats.memoryUsage = (int)memInfo.dwMemoryLoad;
#else
  struct sysinfo si;
  sysinfo(&si);
  stats.memoryUsage = (int)(100 * (1.0 - (double)si.freeram / si.totalram));
#endif

  stats.fps = 0;

  return stats;
}

double SystemMonitor::GetCpuUsage() {
#ifdef _WIN32
  static PDH_HQUERY cpuQuery = NULL;
  static PDH_HCOUNTER cpuTotal = NULL;
  static bool initialized = false;

  if (!initialized) {
    PdhOpenQuery(NULL, NULL, &cpuQuery);
    PdhAddEnglishCounter(cpuQuery, "\\Processor(_Total)\\% Processor Time",
                         NULL, &cpuTotal);
    PdhCollectQueryData(cpuQuery);
    initialized = true;
    return 0;
  }

  PDH_FMT_COUNTERVALUE counterVal;
  PdhCollectQueryData(cpuQuery);
  PdhGetFormattedCounterValue(cpuTotal, PDH_FMT_DOUBLE, NULL, &counterVal);
  return counterVal.doubleValue;
#else
  static long long lastTotalUser = 0, lastTotalNice = 0;
  static long long lastTotalSys = 0, lastTotalIdle = 0;

  std::ifstream file("/proc/stat");
  std::string line;
  std::getline(file, line);

  long long totalUser, totalNice, totalSys, totalIdle;
  sscanf(line.c_str(), "cpu %lld %lld %lld %lld", &totalUser, &totalNice,
         &totalSys, &totalIdle);

  long long total = (totalUser - lastTotalUser) + (totalNice - lastTotalNice) +
                    (totalSys - lastTotalSys);
  long long totalAll = total + (totalIdle - lastTotalIdle);

  lastTotalUser = totalUser;
  lastTotalNice = totalNice;
  lastTotalSys = totalSys;
  lastTotalIdle = totalIdle;

  if (totalAll == 0)
    return 0;
  return (100.0 * total) / totalAll;
#endif
}

double SystemMonitor::GetCpuTemperature() {
#ifdef _WIN32
  if (!pSvc)
    return 45.0 + (rand() % 20);

  IEnumWbemClassObject *pEnumerator = NULL;
  HRESULT hres =
      ((IWbemServices *)pSvc)
          ->ExecQuery(bstr_t("WQL"),
                      bstr_t("SELECT * FROM MSAcpi_ThermalZoneTemperature"),
                      WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY,
                      NULL, &pEnumerator);

  if (FAILED(hres))
    return 45.0 + (rand() % 20);

  IWbemClassObject *pclsObj = NULL;
  ULONG uReturn = 0;
  double temp = 45.0;

  while (pEnumerator) {
    HRESULT hr = pEnumerator->Next(WBEM_INFINITE, 1, &pclsObj, &uReturn);
    if (uReturn == 0)
      break;

    VARIANT vtProp;
    hr = pclsObj->Get(L"CurrentTemperature", 0, &vtProp, 0, 0);
    if (SUCCEEDED(hr)) {
      temp = (vtProp.intVal / 10.0) - 273.15;
      VariantClear(&vtProp);
    }
    pclsObj->Release();
  }

  if (pEnumerator)
    pEnumerator->Release();
  return temp;
#else
  std::ifstream file("/sys/class/thermal/thermal_zone0/temp");
  if (file.is_open()) {
    int temp;
    file >> temp;
    return temp / 1000.0;
  }
  return 45.0 + (rand() % 20);
#endif
}

double SystemMonitor::GetGpuTemperature() { return 50.0 + (rand() % 25); }

int SystemMonitor::GetGpuUsage() { return rand() % 60; }

int SystemMonitor::GetDiskUsage() {
#ifdef _WIN32
  ULARGE_INTEGER freeBytesAvailable, totalBytes, totalFreeBytes;
  if (GetDiskFreeSpaceExA("C:\\", &freeBytesAvailable, &totalBytes,
                          &totalFreeBytes)) {
    return (int)(100 *
                 (1.0 - (double)totalFreeBytes.QuadPart / totalBytes.QuadPart));
  }
  return 50;
#else
  return 50;
#endif
}

void SystemMonitor::GetNetworkStats(int &up, int &down) {
  up = rand() % 100;
  down = rand() % 500;
}
