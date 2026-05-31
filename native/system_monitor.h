#ifndef SYSTEM_MONITOR_H
#define SYSTEM_MONITOR_H

#include <string>
#include <cstdint>

struct SystemInfo {
    std::string cpuModel;
    int cpuCores;
    int cpuSpeed;
    uint64_t totalMemory;
    uint64_t freeMemory;
    std::string platform;
    std::string release;
    std::string hostname;
    uint64_t uptime;
};

struct LiveStats {
    int cpuUsage;
    int memoryUsage;
    double cpuTemp;
    double gpuTemp;
    int gpuUsage;
    int diskUsage;
    int networkUp;
    int networkDown;
    int fps;
};

class SystemMonitor {
public:
    SystemMonitor();
    ~SystemMonitor();
    
    SystemInfo GetSystemInfo();
    LiveStats GetLiveStats();
    
private:
    double GetCpuUsage();
    double GetCpuTemperature();
    double GetGpuTemperature();
    int GetGpuUsage();
    int GetDiskUsage();
    void GetNetworkStats(int& up, int& down);
    
#ifdef _WIN32
    void InitializeWMI();
    void CleanupWMI();
    void* pLoc;
    void* pSvc;
#endif
};

#endif
