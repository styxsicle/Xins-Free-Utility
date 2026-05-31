#include "napi.h"
#include "system_monitor.h"
#include "tweaks_engine.h"

Napi::Object GetSystemInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);
    
    SystemMonitor monitor;
    SystemInfo sysInfo = monitor.GetSystemInfo();
    
    Napi::Object cpu = Napi::Object::New(env);
    cpu.Set("model", sysInfo.cpuModel);
    cpu.Set("cores", sysInfo.cpuCores);
    cpu.Set("speed", sysInfo.cpuSpeed);
    result.Set("cpu", cpu);
    
    Napi::Object memory = Napi::Object::New(env);
    memory.Set("total", (double)sysInfo.totalMemory);
    memory.Set("free", (double)sysInfo.freeMemory);
    memory.Set("used", (double)(sysInfo.totalMemory - sysInfo.freeMemory));
    result.Set("memory", memory);
    
    Napi::Object os = Napi::Object::New(env);
    os.Set("platform", sysInfo.platform);
    os.Set("release", sysInfo.release);
    os.Set("hostname", sysInfo.hostname);
    result.Set("os", os);
    
    result.Set("uptime", (double)sysInfo.uptime);
    
    return result;
}

Napi::Object GetLiveStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);
    
    SystemMonitor monitor;
    LiveStats stats = monitor.GetLiveStats();
    
    result.Set("cpuUsage", stats.cpuUsage);
    result.Set("memoryUsage", stats.memoryUsage);
    result.Set("cpuTemp", stats.cpuTemp);
    result.Set("gpuTemp", stats.gpuTemp);
    result.Set("gpuUsage", stats.gpuUsage);
    result.Set("diskUsage", stats.diskUsage);
    result.Set("networkUp", stats.networkUp);
    result.Set("networkDown", stats.networkDown);
    result.Set("fps", stats.fps);
    
    return result;
}

Napi::Object ApplyTweak(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);
    
    if (info.Length() < 2) {
        result.Set("success", false);
        result.Set("message", "Missing arguments");
        return result;
    }
    
    std::string tweakId = info[0].As<Napi::String>().Utf8Value();
    std::string action = info[1].As<Napi::String>().Utf8Value();
    
    TweaksEngine engine;
    TweakResult tweakResult = engine.ApplyTweak(tweakId, action == "apply");
    
    result.Set("success", tweakResult.success);
    result.Set("message", tweakResult.message);
    
    return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("getSystemInfo", Napi::Function::New(env, GetSystemInfo));
    exports.Set("getLiveStats", Napi::Function::New(env, GetLiveStats));
    exports.Set("applyTweak", Napi::Function::New(env, ApplyTweak));
    return exports;
}

NODE_API_MODULE(tweaks_native, Init)
