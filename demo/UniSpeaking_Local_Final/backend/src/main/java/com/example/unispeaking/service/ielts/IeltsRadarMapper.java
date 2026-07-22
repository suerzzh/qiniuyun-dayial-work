package com.example.unispeaking.service.ielts;

import com.example.unispeaking.model.ielts.IeltsDimensionResult;
import com.example.unispeaking.model.ielts.RadarDimension;
import com.example.unispeaking.model.ielts.TaskAchievementResult;

import java.util.List;

public class IeltsRadarMapper {
    public List<RadarDimension> map(IeltsDimensionResult fc, IeltsDimensionResult lr,
                                    IeltsDimensionResult gra, IeltsDimensionResult pronunciation,
                                    TaskAchievementResult taskAchievement) {
        return List.of(
                new RadarDimension("FC", "流利度与连贯性", bandScore(fc)),
                new RadarDimension("LR", "词汇资源", bandScore(lr)),
                new RadarDimension("GRA", "语法多样性与准确性", bandScore(gra)),
                new RadarDimension("P", "发音", bandScore(pronunciation)),
                new RadarDimension("TA", "任务完成度/互动回应", taskAchievement.score()));
    }

    private Integer bandScore(IeltsDimensionResult dimension) {
        return dimension == null || dimension.band() == null
                ? null : (int) Math.round(dimension.band() / 9.0 * 100.0);
    }
}
