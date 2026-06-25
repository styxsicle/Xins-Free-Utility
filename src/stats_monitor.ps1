$ErrorActionPreference = "SilentlyContinue"

# Use CIM for potentially faster/lighter access than WMI
# Pre-define classes if possible

while($true) {
    try {
        # 1. CPU Usage (from Processor Time)
        # Using PerfFormattedData avoids calculation lag
        $cpuObj = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction SilentlyContinue
        $cpu = if ($cpuObj) { $cpuObj.PercentProcessorTime } else { 0 }

        # 2. Memory Usage (Operating System)
        $osObj = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
        $memTotal = $osObj.TotalVisibleMemorySize
        $memFree = $osObj.FreePhysicalMemory
        $memUsage = [math]::Round((($memTotal - $memFree) / $memTotal) * 100)

        # 3. Disk Usage (PhysicalDisk _Total)
        $diskObj = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'" -ErrorAction SilentlyContinue
        $disk = if ($diskObj) { $diskObj.PercentDiskTime } else { 0 }
        if ($disk -gt 100) { $disk = 100 }

        # 4. Network Usage (Summing actual Sent/Received)
        # Filter out virtual adapters if possible, but mainly just sum > 0
        $netObjs = Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | Where-Object { $_.BytesTotalPersec -gt 0 }
        
        $netUp = 0
        $netDown = 0
        
        if ($netObjs) {
            foreach ($net in $netObjs) {
                # Sum sent (Upload) and received (Download) separately
                $netUp += $net.BytesSentPersec
                $netDown += $net.BytesReceivedPersec
            }
        }

        # 5. GPU (Attempt to get Engine Utilization)
        $gpu = -1
        try {
            # This is often the potentially slow call, try fast
            $gpuObjs = Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction SilentlyContinue
            if ($gpuObjs) {
                # Max utilization is usually a good indicator of "Busy"
                $gpu = ($gpuObjs | Measure-Object -Property UtilizationPercentage -Maximum).Maximum
            }
        } catch {}

        # 6. Process / thread / handle counters (pre-computed perf counters — fast, single-instance CIM)
        $procCount   = 0
        $threadCount = 0
        $handleCount = 0
        try {
            $sysPerfObj  = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_System  -ErrorAction SilentlyContinue
            if ($sysPerfObj) { $procCount = [int]$sysPerfObj.Processes; $threadCount = [int]$sysPerfObj.Threads }
            $objPerfObj  = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Objects -ErrorAction SilentlyContinue
            if ($objPerfObj)  { $handleCount = [int]$objPerfObj.HandleCount }
        } catch {}

        # Construct JSON output
        $result = @{
            cpu         = $cpu
            mem         = $memUsage
            disk        = $disk
            netUp       = $netUp
            netDown     = $netDown
            gpu         = $gpu
            procCount   = $procCount
            threadCount = $threadCount
            handleCount = $handleCount
        } | ConvertTo-Json -Compress

        Write-Output "STATS_DATA:$result"
    } catch {
        # If error, just output empty or continue
    }
    
    # Sleep 250ms for faster updates (4x per second)
    Start-Sleep -Milliseconds 250
}
