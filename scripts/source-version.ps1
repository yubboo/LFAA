<#
功能：读取 LFAA 源码推送提交中的三段版本号。
作用：统一菜单 6 推送版本校验与菜单 8 源码更新版本预览使用的提交说明规则。
#>

function Get-CommitMessageVersion {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$CommitMessage)

    if ($CommitMessage -match '^\s*(?:LFAA\s+)?v?(?<version>\d+\.\d+\.\d+)(?=$|[\s:：-])') {
        return $Matches['version']
    }

    return ''
}

function Resolve-LastPushedVersion {
    param(
        [Alias('RemoteCommitSubjects')]
        [string[]]$CommitSubjects = @(),
        [string]$LocalVersion = '',
        [string]$HistorySource = 'GitHub main 最近的版本提交'
    )

    foreach ($subject in $CommitSubjects) {
        $version = Get-CommitMessageVersion -CommitMessage $subject
        if (-not [string]::IsNullOrWhiteSpace($version)) {
            return [PSCustomObject]@{
                Number = $version
                Source = $HistorySource
            }
        }
    }

    if ($LocalVersion -match '^\d+\.\d+\.\d+$') {
        return [PSCustomObject]@{
            Number = $LocalVersion
            Source = '本机最近一次成功推送记录'
        }
    }

    return [PSCustomObject]@{
        Number = ''
        Source = '尚无可识别的推送版本记录'
    }
}
