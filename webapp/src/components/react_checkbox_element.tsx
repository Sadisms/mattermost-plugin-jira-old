import React, { Component, ChangeEvent } from 'react';

interface CheckBoxProps {
    label: string;
    value: boolean,
    onChecked: (isChecked: boolean) => void;
}


class CheckBox extends Component<CheckBoxProps> {
    constructor(props: CheckBoxProps) {
        super(props);
        this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
    }

    handleCheckboxChange(event: ChangeEvent<HTMLInputElement>) {
        const isChecked = event.target.checked;
        this.props.onChecked(isChecked);
    }

    render() {
        const { label, value } = this.props;

        return (
            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={value}
                        onChange={this.handleCheckboxChange}
                    />
                    {label}
                </label>
            </div>
        );
    }
}

export default CheckBox;
