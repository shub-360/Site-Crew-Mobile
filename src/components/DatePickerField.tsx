import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

interface DatePickerFieldProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
}

export function DatePickerField({ value, onChange, label }: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  const dateValue = value ? new Date(value + "T00:00:00") : new Date();

  const handleOnChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShow(false);
      if (selectedDate) {
        onChange(formatDate(selectedDate));
      }
    } else {
      if (selectedDate) {
        onChange(formatDate(selectedDate));
      }
    }
  };

  const formatDate = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <View className="gap-1.5 flex-1">
      {label && <Text className="text-sm font-medium text-slate-700">{label}</Text>}
      <TouchableOpacity
        onPress={() => setShow(true)}
        className="h-11 px-3 border border-slate-200 rounded-xl bg-white flex-row items-center justify-between"
      >
        <Text className="text-base text-slate-800">
          {value || "Select Date"}
        </Text>
        <Calendar size={16} color="#94A3B8" />
      </TouchableOpacity>

      {show && Platform.OS === "android" && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={handleOnChange}
        />
      )}

      {show && Platform.OS === "ios" && (
        <Modal transparent visible={show} animationType="fade">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShow(false)}
            className="flex-1 bg-black/40 justify-end"
          >
            <View className="bg-white p-4 pb-8 rounded-t-3xl border-t border-border">
              <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <Text className="text-base font-bold text-slate-800">Select Date</Text>
                <TouchableOpacity onPress={() => setShow(false)} className="px-4 py-1.5 bg-primary rounded-xl">
                  <Text className="text-sm font-semibold text-white">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                textColor="#000000"
                onChange={handleOnChange}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}
