#ifndef TWEAKS_ENGINE_H
#define TWEAKS_ENGINE_H

#include <string>
#include <map>

struct TweakResult {
    bool success;
    std::string message;
};

class TweaksEngine {
public:
    TweaksEngine();
    ~TweaksEngine();
    
    TweakResult ApplyTweak(const std::string& tweakId, bool apply);
    
private:
    bool ExecuteCommand(const std::string& command);
    bool SetRegistryValue(const std::string& path, const std::string& name, 
                         const std::string& value, const std::string& type);
    bool DeleteRegistryValue(const std::string& path, const std::string& name);
    bool StopService(const std::string& serviceName);
    bool StartService(const std::string& serviceName);
    bool SetServiceStartType(const std::string& serviceName, int startType);
};

#endif
